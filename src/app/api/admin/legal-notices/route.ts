import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { EmailDeliveryError, legalNoticeEmail, sendTransactionalEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { mutationRequestError, safeError } from "@/lib/http";
import {
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  legalAcceptanceVersionKey,
} from "@/lib/legal";
import { getSessionUser, isSuperAdminUser } from "@/lib/session";

const inputSchema = z.object({ sendToPendingUsers: z.literal(true) });
const DAILY_BATCH_LIMIT = 90;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Your session has expired or requires legal review." },
        { status: 401 },
      );
    }
    if (!isSuperAdminUser(user)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Confirm the legal-notice send." }, { status: 400 });
    }

    const env = getEnv();
    if (!env.RESEND_API_KEY) {
      return NextResponse.json({ error: "Transactional email is not configured." }, { status: 503 });
    }

    await ensureDbIndexes();
    const db = await getDb();
    const versionKey = legalAcceptanceVersionKey();
    const candidates = await db.collection("users")
      .find({
        status: "active",
        legalNoticeVersion: { $ne: versionKey },
        $or: [
          { termsVersion: { $ne: TERMS_VERSION } },
          { privacyNoticeVersion: { $ne: PRIVACY_NOTICE_VERSION } },
          { termsAcceptedAt: { $not: { $type: "date" } } },
          { privacyAcknowledgedAt: { $not: { $type: "date" } } },
        ],
      })
      .project({ _id: 1, email: 1, displayName: 1 })
      .sort({ createdAt: 1 })
      .limit(DAILY_BATCH_LIMIT)
      .toArray();

    let sent = 0;
    for (const candidate of candidates) {
      if (typeof candidate.email !== "string" || typeof candidate.displayName !== "string") {
        continue;
      }
      try {
        const template = legalNoticeEmail(candidate.displayName, env.APP_BASE_URL);
        const delivery = await sendTransactionalEmail({
          to: candidate.email,
          ...template,
        });
        const sentAt = new Date();
        await db.collection("users").updateOne(
          { _id: candidate._id },
          {
            $set: {
              legalNoticeVersion: versionKey,
              legalNoticeSentAt: sentAt,
              legalNoticeDeliveryId: delivery.id,
              updatedAt: sentAt,
            },
          },
        );
        sent += 1;
      } catch (error) {
        safeError(error);
        const providerStatus = error instanceof EmailDeliveryError ? error.status : 502;
        return NextResponse.json(
          {
            error: "Email delivery stopped after a provider error. No failed address was marked as sent.",
            sent,
            failed: candidates.length - sent,
          },
          { status: providerStatus >= 400 && providerStatus < 600 ? 502 : 500 },
        );
      }
    }

    const remaining = await db.collection("users").countDocuments({
      status: "active",
      legalNoticeVersion: { $ne: versionKey },
      $or: [
        { termsVersion: { $ne: TERMS_VERSION } },
        { privacyNoticeVersion: { $ne: PRIVACY_NOTICE_VERSION } },
        { termsAcceptedAt: { $not: { $type: "date" } } },
        { privacyAcknowledgedAt: { $not: { $type: "date" } } },
      ],
    });
    return NextResponse.json({ ok: true, sent, remaining });
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to send legal notices right now." }, { status: 500 });
  }
}
