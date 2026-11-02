export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/auth/session — tells the client who (if anyone) is logged in.
export async function GET() {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { id: session.userId, name: session.name, role: session.role },
  });
}
