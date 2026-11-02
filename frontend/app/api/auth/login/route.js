export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { verifyPassword, signSession, setSessionCookie } from "@/lib/auth";

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const result = await query(
    `SELECT u.user_id, u.name, u.email, u.password_hash, r.role_name
     FROM users u JOIN roles r ON r.role_id = u.role_id
     WHERE u.email = $1`,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signSession(user);
  setSessionCookie(token);

  return NextResponse.json({
    user: { id: user.user_id, name: user.name, email: user.email, role: user.role_name },
  });
}
