export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// GET /api/materials
//   ?q=cement          search by traditional material, green alternative, category or synonym
//   ?list=traditional  material names + synonym words (for search suggestions)
//   ?list=green        the green materials (for dropdowns such as the project page)
// Alternatives come from the material_recommendations view (curated pairs,
// scored and ranked with a window function), plus the cheapest live vendor price.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("list") === "traditional") {
      const names = await query(
        `SELECT name FROM traditional_materials
         UNION
         SELECT initcap(term) FROM material_synonyms
         ORDER BY 1`
      );
      return NextResponse.json({ traditional: names.rows });
    }

    if (searchParams.get("list") === "green") {
      const green = await query(
        `SELECT material_id, name, category FROM green_materials ORDER BY name`
      );
      return NextResponse.json({ materials: green.rows });
    }

    const q = (searchParams.get("q") || "").trim();

    const result = await query(
      `SELECT
         mr.green_id        AS material_id,
         mr.green_material,
         mr.traditional_material,
         mr.co2_reduction_pct,
         mr.cost_delta_pct,
         mr.sustainability_score,
         mr.score,
         mr.rank_within_material,
         ma.data_quality    AS pair_quality,
         gm.co2_source,
         gm.category,
         gm.co2_per_unit,
         gm.cost_per_unit,
         best.min_price,
         best.vendor_name
       FROM material_recommendations mr
       JOIN green_materials gm ON gm.material_id = mr.green_id
       JOIN material_alternatives ma
         ON ma.traditional_material_id = mr.traditional_id
        AND ma.green_material_id = mr.green_id
       LEFT JOIN LATERAL (
         SELECT vl.price AS min_price, v.name AS vendor_name
         FROM vendor_listings vl
         JOIN vendors v ON v.vendor_id = vl.vendor_id
         WHERE vl.material_id = mr.green_id AND vl.price IS NOT NULL
         ORDER BY vl.price ASC
         LIMIT 1
       ) best ON true
       WHERE $1 = ''
          OR mr.traditional_material ILIKE '%' || $1 || '%'
          OR mr.green_material       ILIKE '%' || $1 || '%'
          OR gm.category             ILIKE '%' || $1 || '%'
          OR mr.traditional_id IN (
               SELECT traditional_material_id FROM material_synonyms
               WHERE term ILIKE '%' || $1 || '%')
       ORDER BY mr.traditional_material, mr.rank_within_material`,
      [q]
    );
    return NextResponse.json({ materials: result.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load materials" }, { status: 500 });
  }
}
