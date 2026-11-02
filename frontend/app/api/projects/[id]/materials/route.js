
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

// GET: Retrieve materials belonging to the logged-in user's project.
export async function GET(request, { params }) {
  const session = getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Login required" },
      { status: 401 }
    );
  }

  try {
    const projectId = Number(params.id);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const ownership = await query(
      `SELECT project_id
       FROM projects
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, session.userId]
    );

    if (ownership.rowCount === 0) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const result = await query(
      `SELECT pm.project_id, pm.material_id, pm.quantity,
              gm.name AS material_name, gm.category,
              gm.co2_per_unit, gm.cost_per_unit
       FROM project_materials pm
       JOIN green_materials gm
         ON gm.material_id = pm.material_id
       WHERE pm.project_id = $1
       ORDER BY gm.name`,
      [projectId]
    );

    return NextResponse.json({ materials: result.rows });
  } catch (error) {
    console.error("Get project materials error:", error);
    return NextResponse.json(
      { error: "Failed to load project materials" },
      { status: 500 }
    );
  }
}

// POST: Add a material to a project.
export async function POST(request, { params }) {
  const session = getSessionFromCookies();

  if (!session) {
    return NextResponse.json(
      { error: "Login required" },
      { status: 401 }
    );
  }

  try {
    const projectId = Number(params.id);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const materialId = Number(body.material_id);
    const quantity = Number(body.quantity);

    if (
      !Number.isInteger(materialId) ||
      materialId <= 0 ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        { error: "Valid material_id and positive quantity are required" },
        { status: 400 }
      );
    }

    const ownership = await query(
      `SELECT project_id
       FROM projects
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, session.userId]
    );

    if (ownership.rowCount === 0) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }

    const result = await query(
      `INSERT INTO project_materials (project_id, material_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, material_id)
       DO UPDATE SET quantity =
         project_materials.quantity + EXCLUDED.quantity
       RETURNING project_id, material_id, quantity`,
      [projectId, materialId, quantity]
    );

    return NextResponse.json(
      {
        message: "Material added successfully",
        projectMaterial: result.rows[0],
        carbonCalculation: "Handled by database trigger"
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add project material error:", error);
    return NextResponse.json(
      { error: "Failed to add material to project" },
      { status: 500 }
    );
  }
}
