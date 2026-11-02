
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST() {
  const auth = requireRole("Admin");

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock all listings eligible for the 90-day sweep.
    const eligible = await client.query(`
      SELECT listing_id
      FROM furniture_listings
      WHERE status = 'Active'
        AND posted_at + INTERVAL '90 days' <= CURRENT_TIMESTAMP
      FOR UPDATE
    `);

    const eligibleIds = eligible.rows.map(
      (row) => row.listing_id
    );

    // Run the existing PostgreSQL stored procedure.
    await client.query("CALL sp_refer_expired_listings()");

    // Count how many of the eligible listings became Referred.
    const referredResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM furniture_listings
        WHERE listing_id = ANY($1::int[])
          AND status = 'Referred'
      `,
      [eligibleIds]
    );

    const totalResult = await client.query(`
      SELECT COUNT(*)::int AS count
      FROM furniture_listings
      WHERE status = 'Referred'
    `);

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "90-day sweep completed",
      referred: referredResult.rows[0].count,
      totalReferred: totalResult.rows[0].count,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin sweep error:", error);

    return NextResponse.json(
      { error: "Failed to run 90-day sweep" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
