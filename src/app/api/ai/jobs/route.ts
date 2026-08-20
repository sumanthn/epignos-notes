import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";

import { processBookCardJobs } from "@/lib/book-cards";
import { processBookConceptJobs } from "@/lib/book-concepts";
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
      type: "organize-note" | "summarize-book-cards" | "extract-book-concepts";
      noteId?: ObjectId | null;
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
          type: { $in: ["organize-note", "summarize-book-cards", "extract-book-concepts"] },
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $set: {
          notificationKey: {
            $cond: [
              { $eq: ["$type", "organize-note"] },
              { $concat: ["note:", { $toString: "$noteId" }] },
              {
                $cond: [
                  { $eq: ["$type", "summarize-book-cards"] },
                  { $concat: ["cards:", { $toString: "$bookId" }] },
                  { $concat: ["concepts:", { $toString: "$bookId" }] },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$notificationKey",
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

    const resumableNotes = jobs
      .filter((job) => job.type === "organize-note")
      .filter((job) => job.status === "queued" || job.status === "processing")
      .map((job) => job._id);
    const resumableCards = jobs
      .filter((job) => job.type === "summarize-book-cards")
      .filter((job) => job.status === "queued" || job.status === "processing")
      .map((job) => job._id);
    const resumableConcepts = jobs
      .filter((job) => job.type === "extract-book-concepts")
      .filter((job) => job.status === "queued" || job.status === "processing")
      .map((job) => job._id);
    if (resumableNotes.length > 0 || resumableCards.length > 0 || resumableConcepts.length > 0) {
      after(async () => {
        if (resumableNotes.length > 0) await processOrganizeJobs(resumableNotes);
        if (resumableCards.length > 0) await processBookCardJobs(resumableCards);
        if (resumableConcepts.length > 0) await processBookConceptJobs(resumableConcepts);
      });
    }

    return NextResponse.json({
      jobs: jobs.map((job) => ({
        id: job._id.toHexString(),
        type: job.type,
        noteId: job.noteId?.toHexString() ?? null,
        bookId: job.bookId.toHexString(),
        title: job.type === "summarize-book-cards"
          ? `${job.book?.name || "Book"} summary cards`
          : job.type === "extract-book-concepts"
            ? `${job.book?.name || "Book"} concepts`
            : job.note?.title || "Note",
        noteTitle: job.note?.title || null,
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
