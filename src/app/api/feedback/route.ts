import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { feedbackInputSchema } from "@/lib/feedback";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser, isSuperAdminUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const MAX_REPORTS_PER_HOUR = 10;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = feedbackInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Add a clear title and description before sending." },
        { status: 400 },
      );
    }

    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    if (isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Feedback is submitted from a workspace." }, { status: 403 });
    }

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    await ensureDbIndexes();
    const db = await getDb();
    const now = new Date();
    const recentCount = await db.collection("feedbackRequests").countDocuments({
      userId: user.id,
      createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1_000) },
    });
    if (recentCount >= MAX_REPORTS_PER_HOUR) {
      return NextResponse.json(
        { error: "You have sent several reports recently. Please try again later." },
        { status: 429 },
      );
    }

    const feedbackId = new ObjectId();
    await db.collection("feedbackRequests").insertOne({
      _id: feedbackId,
      schemaVersion: 1,
      organizationId: identity.organizationId,
      workspaceId: identity.workspaceId,
      userId: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      contextPath: parsed.data.contextPath,
      status: "open",
      createdAt: now,
      updatedAt: now,
      handledBy: null,
      resolvedAt: null,
    });

    return NextResponse.json(
      {
        feedback: {
          id: feedbackId.toHexString(),
          status: "open",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to send your report right now." },
      { status: 500 },
    );
  }
}
