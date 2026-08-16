import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";

import {
  PublicBookCardsError,
  type BookForCards,
  bookCardsStatus,
  enqueueBookCardJob,
  processBookCardJobs,
} from "@/lib/book-cards";
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
  return { user, db, book: book as BookForCards };
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { bookId } = await context.params;
    const scope = await scopedBook(request, bookId);
    if ("error" in scope) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }
    const status = await bookCardsStatus(scope.db, scope.book);
    if (status.job?.status === "queued") {
      after(() => processBookCardJobs([new ObjectId(status.job!.id)]));
    }
    return NextResponse.json(status, {
      status: status.job?.status === "queued" || status.job?.status === "processing" ? 202 : 200,
    });
  } catch (error) {
    safeError(error);
    if (error instanceof PublicBookCardsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to load summary cards right now." },
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
      return NextResponse.json({ error: "AI summary cards are not configured." }, { status: 503 });
    }
    const result = await enqueueBookCardJob(scope.db, scope.book, scope.user.id);
    if (result.kind === "deck") return NextResponse.json({ deck: result.deck, job: null });
    after(() => processBookCardJobs([result.jobId]));
    return NextResponse.json({ deck: null, job: result.job }, { status: 202 });
  } catch (error) {
    safeError(error);
    if (error instanceof PublicBookCardsError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to start summary card generation right now." },
      { status: 500 },
    );
  }
}
