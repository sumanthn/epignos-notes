import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 },
    );
  }
}
