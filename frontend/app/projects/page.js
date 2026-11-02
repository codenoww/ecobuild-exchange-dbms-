"use client";

import { useEffect, useState } from "react";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", style: "", budget: "" });

  const loadProjects = () => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setProjects(data.projects);
      })
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
    loadProjects();
  }

  return (
    <div>
      <h1>My Projects</h1>
      <p>
        Carbon savings for each project are computed automatically from the
        materials you add to it (via a database trigger + stored function).
      </p>
      {error && <p className="error">{error}</p>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Style</th>
              <th>Budget</th>
              <th>CO2 saved</th>
              <th>Material cost</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.project_id}>
                <td>{p.title}</td>
                <td>{p.style || "—"}</td>
                <td>{p.budget != null ? `₹${p.budget}` : "—"}</td>
                <td>{p.total_co2_saved != null ? `${p.total_co2_saved} kg` : "No materials added yet"}</td>
                <td>{p.total_cost != null ? `₹${p.total_cost}` : "—"}</td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5}>No projects yet. Log in and create one below.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <h2>New project</h2>
      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Project title"
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <input
          type="text"
          placeholder="Style (optional)"
          value={form.style}
          onChange={(e) => setForm({ ...form, style: e.target.value })}
        />
        <input
          type="number"
          placeholder="Budget (optional)"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
        />
        <button type="submit">Create project</button>
      </form>
    </div>
  );
}
