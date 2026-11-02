
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
  const session = getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Login required" },
      { status: 401 }
    );
  }

  if (session.role !== "Vendor") {
    return NextResponse.json(
      { error: "Forbidden: Vendor access required" },
      { status: 403 }
    );
  }

  try {
    const result = await query(
      `SELECT vl.listing_id, vl.vendor_id, v.name AS vendor_name,
              vl.material_id, gm.name AS material_name,
              gm.category, vl.price, vl.url, vl.last_synced
       FROM vendor_listings vl
       JOIN vendors v ON v.vendor_id = vl.vendor_id
       JOIN green_materials gm ON gm.material_id = vl.material_id
       WHERE v.owner_user_id = $1
       ORDER BY vl.last_synced DESC`,
      [session.userId]
    );

    return NextResponse.json({ listings: result.rows });
  } catch (error) {
    console.error("Vendor listings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor listings" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const session = getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Login required" },
      { status: 401 }
    );
  }

  if (session.role !== "Vendor") {
    return NextResponse.json(
      { error: "Forbidden: Vendor access required" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { material_id, price, url } = body;

    if (
      !Number.isInteger(Number(material_id)) ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return NextResponse.json(
        { error: "Valid material_id and non-negative price are required" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO vendor_listings (vendor_id, material_id, price, url)
       SELECT v.vendor_id, $2, $3, $4
       FROM vendors v
       WHERE v.owner_user_id = $1
       RETURNING listing_id, vendor_id, material_id, price, url, last_synced`,
      [
        session.userId,
        Number(material_id),
        Number(price),
        url ? String(url).trim() : null
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "No vendor profile is linked to your account" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: "Vendor listing created", listing: result.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error("Vendor listings POST error:", error);
    return NextResponse.json(
      { error: "Failed to create vendor listing" },
      { status: 500 }
    );
  }
}
