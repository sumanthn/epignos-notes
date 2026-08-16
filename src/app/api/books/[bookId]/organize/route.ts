import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { mutationRequestError, safeError } from "@/lib/http";
import {
  PublicOrganizeError,
  enqueueOrganizeJob,
  type NoteForOrganization,
  processOrganizeJobs,
} from "@/lib/organize";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

type RouteContext = { params: Promise<{ bookId: string }> };

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    await request.json();
    const { bookId } = await context.params;
    if (!ObjectId.isValid(bookId)) {
      return NextResponse.json({ error: "Book was not found." }, { status: 404 });
    }
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    if (!getEnv().OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI organization is not configured." }, { status: 503 });
    }

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const objectId = new ObjectId(bookId);
    const book = await db.collection("books").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });
    if (!book) {
      return NextResponse.json({ error: "Book was not found." }, { status: 404 });
    }

    const notes = await db.collection("notes").find({
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      bookId: objectId,
      status: "active",
      plainText: { $type: "string", $ne: "" },
    }).sort({ updatedAt: -1 }).toArray();
    if (notes.length === 0) {
      return NextResponse.json(
        { error: "Add text to a note before organizing this book." },
        { status: 400 },
      );
    }

    const jobIds: ObjectId[] = [];
    let ready = 0;
    const jobs = [];
    const skipped: Array<{ noteId: string; title: string; error: string }> = [];
    for (const note of notes) {
      try {
        const result = await enqueueOrganizeJob(
          db,
          note as NoteForOrganization,
          user.id,
        );
        if (result.kind === "proposal") {
          ready += 1;
        } else {
          jobs.push(result.job);
          if (result.job.status === "queued" || result.job.status === "processing") {
            jobIds.push(result.jobId);
          }
        }
      } catch (error) {
        if (!(error instanceof PublicOrganizeError)) throw error;
        skipped.push({
          noteId: note._id.toHexString(),
          title: note.title,
          error: error.message,
        });
      }
    }

    if (jobIds.length > 0) {
      after(() => processOrganizeJobs(jobIds));
    }
    return NextResponse.json(
      {
        book: { id: book._id.toHexString(), name: book.name },
        organization: {
          total: notes.length,
          ready,
          background: jobs.length,
          skipped: skipped.length,
          jobs,
          skippedNotes: skipped,
        },
      },
      { status: jobIds.length > 0 ? 202 : 200 },
    );
  } catch (error) {
    safeError(error);
    if (error instanceof PublicOrganizeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to start book organization right now." },
      { status: 500 },
    );
  }
}
