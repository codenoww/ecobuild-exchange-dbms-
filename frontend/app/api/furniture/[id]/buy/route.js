export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// POST /api/furniture/:id/buy
// Calls the sp_purchase_listing stored procedure, which row-locks the
// listing, validates it's still Active, records the transaction, and
// flips the listing to Sold — all inside one DB transaction.
export async function POST(request, { params }) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const listingId = Number(params.id);
  if (!Number.isInteger(listingId)) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 });
  }

  const { price } = await request.json();
  if (price == null) {
    return NextResponse.json({ error: "price is required" }, { status: 400 });
  }

  try {
    await query("CALL sp_purchase_listing($1, $2, $3)", [
      listingId,
      session.userId,
      price,
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // sp_purchase_listing RAISEs an exception for a missing/non-Active
    // listing — surface that message rather than a generic 500.
    console.error(err);
    return NextResponse.json({ error: err.message || "Purchase failed" }, { status: 400 });
  }
}
