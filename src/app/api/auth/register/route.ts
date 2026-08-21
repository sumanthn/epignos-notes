import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { mutationRequestError, safeError } from "@/lib/http";
import { PRIVACY_NOTICE_VERSION, TERMS_VERSION } from "@/lib/legal";
import { hashPassword, validatePassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  organizationName: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string(),
  acceptedTerms: z.boolean().default(false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  if (getEnv().AUTH_REQUIRE_EMAIL_VERIFICATION) {
    return NextResponse.json(
      { error: "Registration is unavailable until email verification is configured." },
      { status: 503 },
    );
  }

  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid name, email, and password." }, { status: 400 });
    }

    const { displayName, organizationName, email, password, acceptedTerms } = parsed.data;
    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "Read and accept the Terms of Use and acknowledge the Privacy Notice to create an account." },
        { status: 400 },
      );
    }
    const passwordError = validatePassword(password, email);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    await ensureDbIndexes();
    const db = await getDb();
    const now = new Date();
    const userId = new ObjectId();
    const passwordHash = await hashPassword(password);

    try {
      await db.collection("users").insertOne({
        _id: userId,
        schemaVersion: 1,
        email,
        emailNormalized: email,
        passwordHash,
        displayName,
        status: "active",
        systemRole: null,
        emailVerifiedAt: now,
        passwordChangedAt: now,
        termsAcceptedAt: now,
        termsVersion: TERMS_VERSION,
        privacyAcknowledgedAt: now,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        authVersion: 1,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        disabledAt: null,
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 11000) {
        return NextResponse.json({ error: "Unable to create that account." }, { status: 409 });
      }
      throw error;
    }

    await ensurePersonalHierarchy(userId, displayName, organizationName);
    const token = await createSession(
      { id: userId, email, displayName, authVersion: 1, systemRole: null },
      request,
    );
    const response = NextResponse.json({ ok: true }, { status: 201 });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to create your account right now." }, { status: 500 });
  }
}
