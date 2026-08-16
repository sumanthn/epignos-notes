import { ObjectId } from "mongodb";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { mutationRequestError, safeError } from "@/lib/http";
import {
  CanonicalContent,
  contentFromText,
  contentHash,
  isCanonicalContent,
} from "@/lib/note-content";
import {
  PublicOrganizeError,
  type NoteForOrganization,
  enqueueOrganizeJob,
  normalizedOrganizedNote,
  organizeStatus,
  processOrganizeJobs,
  proposalView,
} from "@/lib/organize";
import { isUntitledNoteTitle, noteTextWithSummary } from "@/lib/plain-text";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const applyInputSchema = z.object({
  proposalId: z.string().refine((value) => ObjectId.isValid(value)),
  expectedRevision: z.number().int().positive(),
});

type RouteContext = { params: Promise<{ noteId: string }> };

function proposalResponse(proposal: {
  _id: ObjectId;
  sourceRevision: number;
  value: unknown;
}): NextResponse {
  return NextResponse.json({ proposal: proposalView(proposal) });
}

export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    await request.json();
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

    const env = getEnv();
    if (!env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI organization is not configured." }, { status: 503 });
    }

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const objectId = new ObjectId(noteId);
    const note = await db.collection("notes").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });
    if (!note) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    const result = await enqueueOrganizeJob(
      db,
      note as NoteForOrganization,
      user.id,
    );
    if (result.kind === "proposal") return proposalResponse(result.proposal);

    after(() => processOrganizeJobs([result.jobId]));
    return NextResponse.json({ job: result.job }, { status: 202 });
  } catch (error) {
    safeError(error);
    if (error instanceof PublicOrganizeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to start organization right now." },
      { status: 500 },
    );
  }
}

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

    const result = await organizeStatus(db, note as NoteForOrganization);
    if (result.kind === "proposal") return proposalResponse(result.proposal);
    if (result.kind === "none") {
      return NextResponse.json({ job: null });
    }
    if (result.job.status === "queued") {
      after(() => processOrganizeJobs([result.jobId]));
    }
    return NextResponse.json(
      { job: result.job },
      { status: result.job.status === "failed" ? 200 : 202 },
    );
  } catch (error) {
    safeError(error);
    if (error instanceof PublicOrganizeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to check organization right now." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = applyInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "The organization proposal is invalid." }, { status: 400 });
    }
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
    const objectId = new ObjectId(noteId);
    const proposalId = new ObjectId(parsed.data.proposalId);
    const [note, proposal] = await Promise.all([
      db.collection("notes").findOne({
        _id: objectId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
      }),
      db.collection("aiProposals").findOne({
        _id: proposalId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        noteId: objectId,
        type: "organize",
        status: "proposed",
      }),
    ]);
    if (!note || !proposal) {
      return NextResponse.json({ error: "The organization proposal was not found." }, { status: 404 });
    }
    if (
      note.revision !== parsed.data.expectedRevision ||
      proposal.sourceRevision !== note.revision ||
      proposal.sourceHash !== note.contentHash
    ) {
      return NextResponse.json(
        { error: "This note changed after the suggestion was created. Organize it again." },
        { status: 409 },
      );
    }

    const value = normalizedOrganizedNote(proposal.value);
    const previous = isCanonicalContent(note.content)
      ? (note.content as CanonicalContent)
      : undefined;
    const renderedBody = noteTextWithSummary(value.summary, value.body);
    const content = contentFromText(renderedBody, previous);
    const now = new Date();
    await db.collection("noteRevisions").updateOne(
      { noteId: objectId, revision: note.revision },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          schemaVersion: 1,
          organizationId: identity.organizationId,
          workspaceId: identity.workspaceId,
          noteId: objectId,
          revision: note.revision,
          title: note.title,
          contentSchemaVersion: note.contentSchemaVersion ?? 1,
          content: note.content,
          contentHash: note.contentHash,
          createdBy: user.id,
          createdAt: now,
          reason: "before-ai-apply",
        },
      },
      { upsert: true },
    );
    const result = await db.collection("notes").findOneAndUpdate(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
        revision: parsed.data.expectedRevision,
        contentHash: note.contentHash,
      },
      {
        $set: {
          title: value.title,
          titleSource: isUntitledNoteTitle(note.title) ? "ai-approved" : note.titleSource,
          content,
          plainText: renderedBody,
          contentHash: contentHash(content),
          "approvedAi.summary": value.summary,
          "approvedAi.proposalId": proposalId,
          "approvedAi.updatedAt": now,
          "approvedAi.sourceRevision": note.revision,
          updatedBy: user.id,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      return NextResponse.json(
        { error: "This note changed after the suggestion was created. Organize it again." },
        { status: 409 },
      );
    }

    await db.collection("aiProposals").updateOne(
      { _id: proposalId, status: "proposed" },
      { $set: { status: "accepted", decidedAt: now, decidedBy: user.id } },
    );
    await db.collection("aiJobs").updateOne(
      { proposalId, status: "completed" },
      { $set: { status: "applied", updatedAt: now } },
    );

    return NextResponse.json({
      note: {
        id: result._id.toHexString(),
        title: result.title,
        body: result.plainText,
        revision: result.revision,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to apply this organization right now." },
      { status: 500 },
    );
  }
}
