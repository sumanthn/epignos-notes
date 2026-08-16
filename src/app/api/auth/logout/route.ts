import { NextRequest, NextResponse } from "next/server";

import { mutationRequestError, safeError } from "@/lib/http";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestError = mutationRequestError(request);
  if (requestError) return requestError;

  try {
    await revokeCurrentSession(request);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    safeError(error);
    return NextResponse.json({ error: "Unable to sign out right now." }, { status: 500 });
  }
}
