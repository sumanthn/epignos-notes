import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Use a book name between 1 and 100 characters." }, { status: 400 });
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
    const lastBook = await db.collection("books").findOne(
      {
        organizationId: identity.organizationId,
        workspaceId: identity.workspaceId,
        status: "active",
      },
      { sort: { position: -1 }, projection: { position: 1 } },
    );
    const now = new Date();
    const book = {
      _id: new ObjectId(),
      schemaVersion: 1,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      name: parsed.data.name,
      normalizedName: parsed.data.name.toLocaleLowerCase(),
      description: "",
      position: (typeof lastBook?.position === "number" ? lastBook.position : 0) + 100,
      systemKey: null,
      status: "active",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    await db.collection("books").insertOne(book);
    return NextResponse.json(
      { book: { id: book._id.toHexString(), name: book.name, systemKey: null } },
      { status: 201 },
    );
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to create this book right now." }, { status: 500 });
  }
}
