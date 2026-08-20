import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import {
  CanonicalContent,
  MAX_NOTE_TEXT_LENGTH,
  contentFromText,
  contentHash,
  isCanonicalContent,
  normalizeRichTextContent,
  textFromContent,
} from "@/lib/note-content";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(MAX_NOTE_TEXT_LENGTH).optional(),
    content: z.unknown().optional(),
  })
  .refine((value) => value.content !== undefined || value.body !== undefined);

const deleteInputSchema = z.object({
  expectedRevision: z.number().int().positive(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> },
): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const { noteId } = await context.params;
    if (!ObjectId.isValid(noteId)) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Check the note title and content." }, { status: 400 });
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const objectId = new ObjectId(noteId);
    const existing = await db.collection("notes").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });

    if (!existing) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    if (existing.revision !== parsed.data.expectedRevision) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before saving again." },
        { status: 409 },
      );
    }

    const previous = isCanonicalContent(existing.content)
      ? (existing.content as CanonicalContent)
      : undefined;
    const content = parsed.data.content === undefined
      ? contentFromText(parsed.data.body ?? "", previous)
      : normalizeRichTextContent(parsed.data.content);
    if (!content) {
      return NextResponse.json({ error: "This note contains unsupported formatting." }, { status: 400 });
    }
    const plainText = textFromContent(content);
    if (plainText.length > MAX_NOTE_TEXT_LENGTH) {
      return NextResponse.json({ error: "This note is too large to save." }, { status: 400 });
    }
    const now = new Date();
    const result = await db.collection("notes").findOneAndUpdate(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
        revision: parsed.data.expectedRevision,
      },
      {
        $set: {
          title: parsed.data.title,
          titleSource: "user",
          content,
          contentSchemaVersion: 2,
          plainText,
          contentHash: contentHash(content),
          updatedBy: user.id,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before saving again." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      note: {
        id: result._id.toHexString(),
        revision: result.revision,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to save this note right now." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ noteId: string }> },
): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const { noteId } = await context.params;
    if (!ObjectId.isValid(noteId)) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    const parsed = deleteInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Unable to delete this note." }, { status: 400 });
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
    const existing = await db.collection("notes").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });

    if (!existing) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }

    if (existing.revision !== parsed.data.expectedRevision) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before deleting it." },
        { status: 409 },
      );
    }

    const now = new Date();
    const result = await db.collection("notes").updateOne(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
        revision: parsed.data.expectedRevision,
      },
      {
        $set: {
          status: "archived",
          archivedAt: now,
          updatedBy: user.id,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
    );

    if (result.modifiedCount !== 1) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before deleting it." },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to delete this note right now." }, { status: 500 });
  }
}
