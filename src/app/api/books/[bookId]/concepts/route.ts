import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";

import {
  type BookForConcepts,
  bookConceptsStatus,
  enqueueBookConceptJob,
  processBookConceptJobs,
  PublicBookConceptsError,
} from "@/lib/book-concepts";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

type RouteContext = { params: Promise<{ bookId: string }> };

async function scopedBook(request: NextRequest, bookId: string) {
  if (!ObjectId.isValid(bookId)) return { error: "Book was not found." as const, status: 404 };
  const user = await getSessionUser(request);
  if (!user) return { error: "Your session has expired. Please sign in again." as const, status: 401 };
  const identity = await ensurePersonalHierarchy(user.id, user.displayName);
  const db = await getDb();
  const book = await db.collection("books").findOne({
    _id: new ObjectId(bookId),
    organizationId: identity.organizationId,
    workspaceId: identity.workspaceId,
    status: "active",
  });
  if (!book) return { error: "Book was not found." as const, status: 404 };
  return { user, db, book: book as BookForConcepts };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { bookId } = await context.params;
    const scope = await scopedBook(request, bookId);
    if ("error" in scope) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const status = await bookConceptsStatus(scope.db, scope.book);
    if (status.job?.status === "queued") {
      after(() => processBookConceptJobs([new ObjectId(status.job!.id)]));
    }
    return NextResponse.json(status, {
      status: status.job?.status === "queued" || status.job?.status === "processing" ? 202 : 200,
    });
  } catch (error) {
    safeError(error);
    if (error instanceof PublicBookConceptsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to load concepts right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    await request.json();
    const { bookId } = await context.params;
    const scope = await scopedBook(request, bookId);
    if ("error" in scope) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    if (!getEnv().OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI concepts are not configured." }, { status: 503 });
    }
    const result = await enqueueBookConceptJob(scope.db, scope.book, scope.user.id);
    if (result.kind === "map") return NextResponse.json({ map: result.map, job: null });
    after(() => processBookConceptJobs([result.jobId]));
    return NextResponse.json({ map: null, job: result.job }, { status: 202 });
  } catch (error) {
    safeError(error);
    if (error instanceof PublicBookConceptsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to start concept generation right now." },
      { status: 500 },
    );
  }
}

