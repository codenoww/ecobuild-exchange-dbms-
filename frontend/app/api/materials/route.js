export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/materials
// Lists green material alternatives with their best (lowest) current vendor
// price, pulled from vendor_listings. This is the "material advisor" view.
export async function GET() {
  try {
    const result = await query(
      `SELECT
         gm.material_id,
         gm.name AS green_material,
         gm.co2_per_unit,
         gm.cost_per_unit,
         tm.name AS traditional_material,
         ma.co2_reduction_pct,
         ma.cost_delta_pct,
         best.min_price,
         best.vendor_name
       FROM green_materials gm
       JOIN material_alternatives ma ON ma.green_material_id = gm.material_id
       JOIN traditional_materials tm ON tm.material_id = ma.traditional_material_id
       LEFT JOIN LATERAL (
         SELECT vl.price AS min_price, v.name AS vendor_name
         FROM vendor_listings vl
         JOIN vendors v ON v.vendor_id = vl.vendor_id
         WHERE vl.material_id = gm.material_id AND vl.price IS NOT NULL
         ORDER BY vl.price ASC
         LIMIT 1
       ) best ON true
       ORDER BY gm.name`
    );
    return NextResponse.json({ materials: result.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load materials" }, { status: 500 });
  }
}
