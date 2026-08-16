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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> },
): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Use a book name between 1 and 100 characters." },
        { status: 400 },
      );
    }

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

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const db = await getDb();
    const objectId = new ObjectId(bookId);
    const book = await db.collection("books").findOne({
      _id: objectId,
      organizationId: identity.organizationId,
      status: "active",
    });
    if (!book) {
      return NextResponse.json({ error: "Book was not found." }, { status: 404 });
    }
    if (book.systemKey === "unsorted") {
      return NextResponse.json({ error: "Quick Capture cannot be renamed." }, { status: 403 });
    }

    const now = new Date();
    const result = await db.collection("books").findOneAndUpdate(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        status: "active",
        systemKey: null,
      },
      {
        $set: {
          name: parsed.data.name,
          normalizedName: parsed.data.name.toLocaleLowerCase(),
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );
    if (!result) {
      return NextResponse.json({ error: "Book was not found." }, { status: 404 });
    }

    return NextResponse.json({
      book: { id: result._id.toHexString(), name: result.name },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to rename this book right now." }, { status: 500 });
  }
}
