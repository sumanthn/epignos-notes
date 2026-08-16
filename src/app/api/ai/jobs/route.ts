import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { safeError } from "@/lib/http";
import { processOrganizeJobs } from "@/lib/organize";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const jobs = await db.collection("aiJobs").aggregate<{
      _id: ObjectId;
      noteId: ObjectId;
      bookId: ObjectId;
      status: "queued" | "processing" | "completed" | "failed" | "applied";
      error?: string | null;
      proposalId?: ObjectId | null;
      createdAt: Date;
      updatedAt: Date;
      note?: { title?: string };
      book?: { name?: string };
    }>([
      {
        $match: {
          organizationId: identity.organizationId,
          workspaceId: identity.workspaceId,
          type: "organize-note",
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$noteId",
          latestJob: { $first: "$$ROOT" },
        },
      },
      { $replaceWith: "$latestJob" },
      { $sort: { updatedAt: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: "notes",
          localField: "noteId",
          foreignField: "_id",
          as: "noteRows",
        },
      },
      {
        $lookup: {
          from: "books",
          localField: "bookId",
          foreignField: "_id",
          as: "bookRows",
        },
      },
      {
        $set: {
          note: { $first: "$noteRows" },
          book: { $first: "$bookRows" },
        },
      },
      { $unset: ["noteRows", "bookRows"] },
    ]).toArray();

    const resumable = jobs
      .filter((job) => job.status === "queued" || job.status === "processing")
      .map((job) => job._id);
    if (resumable.length > 0) {
      after(() => processOrganizeJobs(resumable));
    }

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job._id.toHexString(),
        noteId: job.noteId.toHexString(),
        bookId: job.bookId.toHexString(),
        noteTitle: job.note?.title || "Note",
        bookName: job.book?.name || "Book",
        status: job.status,
        error: typeof job.error === "string" ? job.error : null,
        proposalId: job.proposalId ? job.proposalId.toHexString() : null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to load AI notifications right now." },
      { status: 500 },
    );
  }
}
