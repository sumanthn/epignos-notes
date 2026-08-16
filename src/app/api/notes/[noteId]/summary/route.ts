import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { safeError } from "@/lib/http";
import { normalizedOrganizedNote } from "@/lib/organize";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

type RouteContext = { params: Promise<{ noteId: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  try {
    const { noteId } = await context.params;
    if (!ObjectId.isValid(noteId)) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const note = await db.collection("notes").findOne({
      _id: new ObjectId(noteId),
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });
    if (!note) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    const approvedSummary = typeof note.approvedAi?.summary === "string"
      ? note.approvedAi.summary.trim()
      : "";
    const approvedSourceRevision = note.approvedAi?.sourceRevision;
    if (
      approvedSummary &&
      typeof approvedSourceRevision === "number" &&
      note.revision === approvedSourceRevision + 1
    ) {
      return NextResponse.json({ summary: approvedSummary, source: "approved" });
    }

    const proposal = await db.collection("aiProposals").findOne({
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      noteId: note._id,
      type: "organize",
      status: "proposed",
      sourceRevision: note.revision,
      sourceHash: note.contentHash,
    }, { sort: { createdAt: -1 } });
    if (proposal) {
      try {
        const value = normalizedOrganizedNote(proposal.value);
        return NextResponse.json({ summary: value.summary, source: "suggested" });
      } catch (error) {
        safeError(error);
      }
    }

    return NextResponse.json({ summary: null, source: null });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to load this note’s summary right now." },
      { status: 500 },
    );
  }
}
