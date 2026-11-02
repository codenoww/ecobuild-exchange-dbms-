
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = requireRole("Admin");

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    // Listings approaching their 90-day cutoff.
    const expiryResult = await query(`
      SELECT
        listing_id,
        title,
        seller_id,
        posted_at,
        expires_on,
        status
      FROM listings_nearing_expiry
      ORDER BY expires_on ASC
    `);

    // Historical junkyard referral records.
    const referralResult = await query(`
      SELECT
        jr.referral_id,
        jr.listing_id,
        fl.title AS listing_title,
        j.name AS junkyard_name,
        j.location AS junkyard_location,
        jr.referred_at
      FROM junkyard_referrals jr
      JOIN furniture_listings fl
        ON fl.listing_id = jr.listing_id
      JOIN junkyards j
        ON j.junkyard_id = jr.junkyard_id
      ORDER BY jr.referred_at DESC
    `);

    return NextResponse.json({
      listingsNearingExpiry: expiryResult.rows,
      referrals: referralResult.rows,
    });
  } catch (error) {
    console.error("Admin overview error:", error);

    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
