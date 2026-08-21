import { createHash, createHmac, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { hasCurrentLegalAcceptance } from "@/lib/legal";
import { isSuperAdminUser, type SystemRole } from "./system-role";

export { isSuperAdminUser } from "./system-role";

const IDLE_MS = 7 * 24 * 60 * 60 * 1_000;
const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1_000;
const SESSION_LIMIT = 10;

export interface SessionUser {
  id: ObjectId;
  email: string;
  displayName: string;
  authVersion: number;
  systemRole: SystemRole;
  legalAcceptanceRequired: boolean;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requestNetworkHash(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const networkValue = forwarded || "unknown";
  return createHmac("sha256", getEnv().AUTH_HMAC_SECRET)
    .update(networkValue)
    .digest("hex");
}

export function sessionCookieName(): string {
  return getEnv().COOKIE_SECURE ? "__Host-epinote_session" : "epinote_session_dev";
}

export async function createSession(
  user: Omit<SessionUser, "legalAcceptanceRequired">,
  request: NextRequest,
): Promise<string> {
  await ensureDbIndexes();
  const db = await getDb();
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + IDLE_MS);
  const absoluteExpiresAt = new Date(now.getTime() + ABSOLUTE_MS);

  await db.collection("sessions").insertOne({
    schemaVersion: 1,
    userId: user.id,
    tokenHash: hashToken(token),
    status: "active",
    authVersion: user.authVersion,
    createdAt: now,
    expiresAt,
    absoluteExpiresAt,
    lastSeenAt: now,
    revokedAt: null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) || "unknown",
    deviceLabel: "Browser",
    ipHash: requestNetworkHash(request),
  });

  const active = await db
    .collection("sessions")
    .find({ userId: user.id, status: "active" })
    .sort({ createdAt: -1 })
    .project({ _id: 1 })
    .toArray();

  if (active.length > SESSION_LIMIT) {
    const oldIds = active.slice(SESSION_LIMIT).map((session) => session._id);
    await db.collection("sessions").updateMany(
      { _id: { $in: oldIds } },
      { $set: { status: "revoked", revokedAt: now } },
    );
  }

  return token;
}

export function attachSessionCookie(response: NextResponse, token: string): void {
  const secure = getEnv().COOKIE_SECURE;
  response.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: IDLE_MS / 1_000,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: getEnv().COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUserByToken(token?: string): Promise<SessionUser | null> {
  if (!token) return null;

  await ensureDbIndexes();
  const db = await getDb();
  const now = new Date();
  const session = await db.collection("sessions").findOne({
    tokenHash: hashToken(token),
    status: "active",
    expiresAt: { $gt: now },
    absoluteExpiresAt: { $gt: now },
  });

  if (!session) return null;

  const user = await db.collection("users").findOne({
    _id: session.userId,
    status: "active",
  });

  if (!user || user.authVersion !== session.authVersion) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > 60 * 60 * 1_000) {
    await db.collection("sessions").updateOne(
      { _id: session._id, status: "active" },
      {
        $set: {
          lastSeenAt: now,
          expiresAt: new Date(
            Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime()),
          ),
        },
      },
    );
  }

  return {
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    authVersion: user.authVersion,
    systemRole: user.systemRole === "superadmin" ? "superadmin" : null,
    legalAcceptanceRequired: !hasCurrentLegalAcceptance(user),
  };
}

export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const user = await getSessionUserByToken(request.cookies.get(sessionCookieName())?.value);
  return user?.legalAcceptanceRequired ? null : user;
}

export function getSessionUserAllowingPendingLegal(
  request: NextRequest,
): Promise<SessionUser | null> {
  return getSessionUserByToken(request.cookies.get(sessionCookieName())?.value);
}

export async function revokeCurrentSession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(sessionCookieName())?.value;
  if (!token) return;

  const db = await getDb();
  await db.collection("sessions").updateOne(
    { tokenHash: hashToken(token), status: "active" },
    { $set: { status: "revoked", revokedAt: new Date() } },
  );
}
