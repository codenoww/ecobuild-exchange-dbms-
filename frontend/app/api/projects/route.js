export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET /api/projects — the logged-in user's projects with their latest
// carbon report (if any). This surfaces the material-advisor carbon
// savings numbers computed by fn_calculate_carbon_savings.
export async function GET() {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT p.project_id, p.title, p.style, p.budget, p.created_at,
              cr.total_co2_saved, cr.total_cost, cr.generated_at
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT total_co2_saved, total_cost, generated_at
         FROM carbon_reports
         WHERE project_id = p.project_id
         ORDER BY generated_at DESC
         LIMIT 1
       ) cr ON true
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [session.userId]
    );
    return NextResponse.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

// POST /api/projects — create a project
export async function POST(request) {
  const session = getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { title, style, budget } = await request.json();
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO projects (user_id, title, style, budget)
       VALUES ($1, $2, $3, $4)
       RETURNING project_id, title, style, budget, created_at`,
      [session.userId, title, style || null, budget || null]
    );
    return NextResponse.json({ project: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
