import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { getSessionUser } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const { workspaceId } = await context.params;
    if (!ObjectId.isValid(workspaceId)) {
      return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    }

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Use a workspace name between 2 and 100 characters." },
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

    const identity = await ensurePersonalHierarchy(user.id, user.displayName);
    const objectId = new ObjectId(workspaceId);
    if (!objectId.equals(identity.workspaceId)) {
      return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    }

    const db = await getDb();
    const membership = await db.collection("memberships").findOne({
      organizationId: identity.organizationId,
      userId: user.id,
      status: "active",
      role: { $in: ["owner", "admin"] },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You do not have permission to rename this workspace." },
        { status: 403 },
      );
    }

    const result = await db.collection("workspaces").findOneAndUpdate(
      {
        _id: objectId,
        organizationId: identity.organizationId,
        status: "active",
      },
      {
        $set: {
          name: parsed.data.name,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ error: "Workspace was not found." }, { status: 404 });
    }

    return NextResponse.json({
      workspace: {
        id: result._id.toHexString(),
        name: result.name,
      },
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to rename this workspace right now." },
      { status: 500 },
    );
  }
}
