import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

export function mutationRequestError(request: NextRequest): NextResponse | null {
  const expectedOrigin = new URL(getEnv().APP_BASE_URL).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }

  return null;
}

export function safeError(error: unknown): void {
  console.error("EpiNote request failed", error instanceof Error ? error.message : error);
}
