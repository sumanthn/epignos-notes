import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ensureDbIndexes, getDb } from "@/lib/db";
import { mutationRequestError, safeError } from "@/lib/http";
import { getDummyPasswordHash, verifyPassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/session";
import { ensurePersonalHierarchy } from "@/lib/workspace";

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await ensureDbIndexes();
    const db = await getDb();
    const user = await db.collection("users").findOne({
      emailNormalized: parsed.data.email,
    });
    const passwordHash = user?.passwordHash || (await getDummyPasswordHash());
    const valid = await verifyPassword(passwordHash, parsed.data.password);

    if (!user || !valid || user.status !== "active") {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await ensurePersonalHierarchy(user._id, user.displayName);
    const token = await createSession(
      {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        authVersion: user.authVersion,
      },
      request,
    );
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } },
    );

    const response = NextResponse.json({ ok: true });
    attachSessionCookie(response, token);
    return response;
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 });
  }
}
