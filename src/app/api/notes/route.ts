import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { contentFromText, contentHash } from "@/lib/note-content";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    await request.json();
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
    }

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const now = new Date();
    const content = contentFromText("");
    const result = await db.collection("notes").insertOne({
      schemaVersion: 1,
      contentSchemaVersion: 1,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      bookId: identity.bookId,
      title: "Untitled note",
      titleSource: "user",
      content,
      plainText: "",
      contentHash: contentHash(content),
      revision: 1,
      source: {
        type: "direct",
        originalAttachmentId: null,
        importedAt: null,
      },
      approvedAi: {
        summary: null,
        conceptIds: [],
        updatedAt: null,
        sourceRevision: null,
        proposalId: null,
      },
      status: "active",
      createdBy: user.id,
      updatedBy: user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });

    return NextResponse.json(
      {
        note: {
          id: result.insertedId.toHexString(),
          bookId: identity.bookId.toHexString(),
          title: "Untitled note",
          body: "",
          revision: 1,
          updatedAt: now.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to create a note right now." }, { status: 500 });
  }
}
