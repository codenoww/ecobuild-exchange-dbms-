export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";

export async function POST(request) {
  const { name, email, password, role } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "name, email, and password are required" },
      { status: 400 }
    );
  }

  // Only allow self-registration as BuyerSeller or Vendor — never Admin.
  const allowedRoles = ["BuyerSeller", "Vendor"];
  const roleName = allowedRoles.includes(role) ? role : "BuyerSeller";

  try {
    const roleResult = await query(
      "SELECT role_id FROM roles WHERE role_name = $1",
      [roleName]
    );
    if (roleResult.rows.length === 0) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const roleId = roleResult.rows[0].role_id;

    const passwordHash = await hashPassword(password);

    const insertResult = await query(
      `INSERT INTO users (role_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, name, email`,
      [roleId, name, email, passwordHash]
    );

    const user = insertResult.rows[0];
    const token = signSession({ ...user, role_name: roleName });
    setSessionCookie(token);

    return NextResponse.json({ user: { ...user, role: roleName } }, { status: 201 });
  } catch (err) {
    if (err.code === "23505") {
      // unique_violation on email
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
