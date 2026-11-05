
"use client";

import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [projectMaterials, setProjectMaterials] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", style: "", budget: "" });
  const [materialForms, setMaterialForms] = useState({});
  const [saving, setSaving] = useState(null);

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load projects");
        return;
      }

      setProjects(data.projects || []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function loadMaterials() {
    try {
      const res = await fetch("/api/materials?list=green");
      const data = await res.json();

      if (res.ok) {
        setMaterials(
          Array.isArray(data) ? data : data.materials || []
        );
      }
    } catch {
      setError("Failed to load available materials");
    }
  }

  async function loadProjectMaterials(projectId) {
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`);
      const data = await res.json();

      if (res.ok) {
        setProjectMaterials((prev) => ({
          ...prev,
          [projectId]: data.materials || [],
        }));
      }
    } catch {
      console.error("Could not load project materials");
    }
  }

  useEffect(() => {
    loadProjects();
    loadMaterials();
  }, []);

  useEffect(() => {
    projects.forEach((project) => {
      loadProjectMaterials(project.project_id);
    });
  }, [projects]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        style: form.style,
        budget: form.budget ? Number(form.budget) : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create project");
      return;
    }

    setForm({ title: "", style: "", budget: "" });
    await loadProjects();
  }

  async function handleAddMaterial(projectId) {
    const selected = materialForms[projectId] || {};
    setError("");

    if (!selected.material_id || !selected.quantity) {
      setError("Select a material and enter a quantity.");
      return;
    }

    setSaving(projectId);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/materials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            material_id: Number(selected.material_id),
            quantity: Number(selected.quantity),
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add material");
        return;
      }

      setMaterialForms((prev) => ({
        ...prev,
        [projectId]: { material_id: "", quantity: "" },
      }));

      await loadProjectMaterials(projectId);
      await loadProjects();
    } catch {
      setError("Could not connect to the server");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="page-container">
      <h1>My Projects</h1>

      <p>
        Carbon savings for each project are computed automatically
        from the materials you add using a database trigger and
        stored function.
      </p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>Loading projects...</p>
      ) : (
        <>
          <h2>Your Projects</h2>

          {projects.length === 0 ? (
            <p>No projects yet. Create your first project below.</p>
          ) : (
            projects.map((project) => (
              <section className="card" key={project.project_id}>
                <h3>{project.title}</h3>

                <p>Style: {project.style || "—"}</p>
                <p>
                  Budget:{" "}
                  {project.budget != null
                    ? `₹${project.budget}`
                    : "—"}
                </p>
                <p>
                  CO2 saved:{" "}
                  {project.total_co2_saved != null
                    ? `${project.total_co2_saved} kg`
                    : "No materials added yet"}
                </p>
                <p>
                  Material cost:{" "}
                  {project.total_cost != null
                    ? `₹${project.total_cost}`
                    : "—"}
                </p>

                <h4>Add Material</h4>

                <select
                  value={
                    materialForms[project.project_id]?.material_id || ""
                  }
                  onChange={(e) =>
                    setMaterialForms((prev) => ({
                      ...prev,
                      [project.project_id]: {
                        ...prev[project.project_id],
                        material_id: e.target.value,
                      },
                    }))
                  }
                >
                  <option value="">Select material</option>
                  {materials.map((material) => (
                    <option
                      key={material.material_id}
                      value={material.material_id}
                    >
                      {material.name} ({material.category})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Quantity"
                  value={
                    materialForms[project.project_id]?.quantity || ""
                  }
                  onChange={(e) =>
                    setMaterialForms((prev) => ({
                      ...prev,
                      [project.project_id]: {
                        ...prev[project.project_id],
                        quantity: e.target.value,
                      },
                    }))
                  }
                />

                <button
                  onClick={() => handleAddMaterial(project.project_id)}
                  disabled={saving === project.project_id}
                >
                  {saving === project.project_id
                    ? "Adding..."
                    : "Add Material"}
                </button>

                <h4>Materials in this Project</h4>

                {(projectMaterials[project.project_id] || []).length === 0 ? (
                  <p>No materials added yet.</p>
                ) : (
                  <ul>
                    {projectMaterials[project.project_id].map((item) => (
                      <li key={item.material_id}>
                        {item.material_name} — Quantity: {item.quantity}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </>
      )}

      <section className="card">
        <h2>New Project</h2>

        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Project title"
            required
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
          />

          <input
            type="text"
            placeholder="Style (optional)"
            value={form.style}
            onChange={(e) =>
              setForm({ ...form, style: e.target.value })
            }
          />

          <input
            type="number"
            min="0"
            placeholder="Budget (optional)"
            value={form.budget}
            onChange={(e) =>
              setForm({ ...form, budget: e.target.value })
            }
          />

          <button type="submit">Create Project</button>
        </form>
      </section>
    </main>
  );
}
