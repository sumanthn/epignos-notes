import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { feedbackStatusInputSchema } from "@/lib/feedback";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser, isSuperAdminUser } from "@/lib/session";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ feedbackId: string }> },
): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const user = await getSessionUser(request);
    if (!user || !isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Request was not found." }, { status: 404 });
    }

    const { feedbackId } = await context.params;
    if (!ObjectId.isValid(feedbackId)) {
      return NextResponse.json({ error: "Request was not found." }, { status: 404 });
    }

    const parsed = feedbackStatusInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid request status." }, { status: 400 });
    }

    await ensureDbIndexes();
    const db = await getDb();
    const now = new Date();
    const completed = parsed.data.status === "resolved" || parsed.data.status === "closed";
    const result = await db.collection("feedbackRequests").findOneAndUpdate(
      { _id: new ObjectId(feedbackId) },
      {
        $set: {
          status: parsed.data.status,
          updatedAt: now,
          handledBy: user.id,
          resolvedAt: completed ? now : null,
        },
      },
      { returnDocument: "after", projection: { status: 1, updatedAt: 1 } },
    );
    if (!result) {
      return NextResponse.json({ error: "Request was not found." }, { status: 404 });
    }

    return NextResponse.json({
      feedback: {
        id: result._id.toHexString(),
        status: result.status,
        updatedAt: result.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to update this request right now." },
      { status: 500 },
    );
  }
}
