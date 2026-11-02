export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/furniture — list marketplace listings (Active first)
export async function GET() {
  try {
    const result = await query(
      `SELECT fl.listing_id, fl.title, fl.category, fl.condition, fl.price,
              fl.status, fl.posted_at, u.name AS seller_name,
              (fl.posted_at + INTERVAL '90 days') AS expires_on
       FROM furniture_listings fl
       JOIN users u ON u.user_id = fl.seller_id
       ORDER BY (fl.status = 'Active') DESC, fl.posted_at DESC`
    );
    return NextResponse.json({ listings: result.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load listings" }, { status: 500 });
  }
}

// POST /api/furniture — create a listing (requires login)
export async function POST(request) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { title, category, condition, price } = await request.json();
  if (!title || !category || !condition || price == null) {
    return NextResponse.json(
      { error: "title, category, condition, and price are required" },
      { status: 400 }
    );
  }

  try {
    const result = await query(
      `INSERT INTO furniture_listings (seller_id, title, category, condition, price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING listing_id, title, category, condition, price, status, posted_at`,
      [session.userId, title, category, condition, price]
    );
    return NextResponse.json({ listing: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }
}
