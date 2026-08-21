import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from "@/lib/legal";
import { getSessionUserAllowingPendingLegal } from "@/lib/session";

const inputSchema = z.object({ accepted: z.literal(true) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Confirm that you agree to the Terms and acknowledge the Privacy Notice." },
        { status: 400 },
      );
    }

    const user = await getSessionUserAllowingPendingLegal(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }

    await ensureDbIndexes();
    const db = await getDb();
    const acceptedAt = new Date();
    const result = await db.collection("users").updateOne(
      { _id: user.id, status: "active" },
      {
        $set: {
          termsAcceptedAt: acceptedAt,
          termsVersion: TERMS_VERSION,
          privacyAcknowledgedAt: acceptedAt,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          updatedAt: acceptedAt,
        },
      },
    );
    if (result.matchedCount !== 1) {
      return NextResponse.json({ error: "That account is unavailable." }, { status: 403 });
    }

    await db.collection("legalAcceptances").updateOne(
      {
        userId: user.id,
        termsVersion: TERMS_VERSION,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      },
      {
        $setOnInsert: {
          schemaVersion: 1,
          userId: user.id,
          termsVersion: TERMS_VERSION,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          acceptedAt,
          source: "authenticated_web",
          userAgent: request.headers.get("user-agent")?.slice(0, 300) || "unknown",
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      ok: true,
      redirectTo: user.systemRole === "superadmin" ? "/admin" : "/workspace",
    });
  } catch (error) {
    safeError(error);
    return NextResponse.json(
      { error: "Unable to record your acceptance right now." },
      { status: 500 },
    );
  }
}
