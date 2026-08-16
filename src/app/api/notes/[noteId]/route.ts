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
} from "@/lib/note-content";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  expectedRevision: z.number().int().positive(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(MAX_NOTE_TEXT_LENGTH),
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
    const content = contentFromText(parsed.data.body, previous);
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
          plainText: parsed.data.body,
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
