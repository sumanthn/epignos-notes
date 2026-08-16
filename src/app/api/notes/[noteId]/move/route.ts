import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  bookId: z.string().refine((value) => ObjectId.isValid(value)),
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
      return NextResponse.json({ error: "Choose a valid destination book." }, { status: 400 });
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
    const targetBookId = new ObjectId(parsed.data.bookId);
    const note = await db.collection("notes").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });

    if (!note) {
      return NextResponse.json({ error: "Note was not found." }, { status: 404 });
    }
    if (note.revision !== parsed.data.expectedRevision) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before moving it." },
        { status: 409 },
      );
    }

    const targetBook = await db.collection("books").findOne({
      _id: targetBookId,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      status: "active",
    });
    if (!targetBook) {
      return NextResponse.json({ error: "Destination book was not found." }, { status: 404 });
    }

    if (note.bookId.equals(targetBookId)) {
      return NextResponse.json({
        note: {
          id: note._id.toHexString(),
          bookId: note.bookId.toHexString(),
          revision: note.revision,
          updatedAt: note.updatedAt.toISOString(),
        },
      });
    }

    const now = new Date();
    const result = await db.collection("notes").findOneAndUpdate(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        bookId: note.bookId,
        status: "active",
        revision: parsed.data.expectedRevision,
      },
      {
        $set: {
          bookId: targetBookId,
          updatedBy: user.id,
          updatedAt: now,
        },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json(
        { error: "This note changed elsewhere. Reload before moving it." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      note: {
        id: result._id.toHexString(),
        bookId: result.bookId.toHexString(),
        revision: result.revision,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to move this note right now." }, { status: 500 });
  }
}
