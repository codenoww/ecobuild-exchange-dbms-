"use client";

import { useEffect, useState } from "react";

export default function MaterialsPage() {
  const [q, setQ] = useState("");
  const [materials, setMaterials] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Names and synonym words for the search box suggestions
  useEffect(() => {
    fetch("/api/materials?list=traditional")
      .then((res) => res.json())
      .then((data) => setSuggestions(data.traditional || []))
      .catch(() => {});
  }, []);

  // Search as you type (small delay so we don't query on every keystroke)
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/materials?q=${encodeURIComponent(q.trim())}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) setError(data.error);
          else {
            setError("");
            setMaterials(data.materials);
          }
        })
        .catch(() => setError("Failed to load materials"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div>
      <h1>Green Material Advisor</h1>
      <p>
        Type a traditional material or a related word (for example cement, concrete,
        brick, steel or glass) to see its green alternatives, ranked best first, with
        CO2 and cost impact and the cheapest vendor price.
      </p>

      <input
        type="search"
        list="traditional-materials"
        placeholder="Search a material, e.g. Portland Cement"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ width: "100%", maxWidth: 480 }}
        aria-label="Search materials"
      />
      <datalist id="traditional-materials">
        {suggestions.map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && materials.length === 0 && (
        <p>No materials match “{q}”.</p>
      )}
      {!loading && !error && materials.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Traditional material</th>
              <th>Green alternative</th>
              <th>Rank</th>
              <th>Score</th>
              <th>CO2 reduction</th>
              <th>Cost delta</th>
              <th>Best vendor price</th>
              <th>CO2 data</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={`${m.material_id}-${m.traditional_material}`}>
                <td>{m.traditional_material}</td>
                <td>
                  {m.green_material}
                  {Number(m.rank_within_material) === 1 && (
                    <span className="tag active" style={{ marginLeft: 8 }}>Best pick</span>
                  )}
                </td>
                <td>{m.rank_within_material}</td>
                <td>{m.score}</td>
                <td>{m.co2_reduction_pct}%</td>
                <td>{m.cost_delta_pct != null ? `${m.cost_delta_pct}%` : "n/a"}</td>
                <td>
                  {m.min_price != null
                    ? `₹${m.min_price} (${m.vendor_name})`
                    : "No vendor pricing yet"}
                </td>
                <td>
                  <span
                    className={`tag ${m.pair_quality === "placeholder" ? "referred" : "active"}`}
                    title={m.co2_source || ""}
                  >
                    {m.pair_quality}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p style={{ fontSize: "0.85rem", color: "#555" }}>
        CO2 values are kg CO2e per kg, cradle to gate. “cited” and “derived” values come
        from published sources (hover the tag to see the source); “placeholder” values are
        not yet sourced. Cost change and the sustainability score are indicative, not sourced.
      </p>
    </div>
  );
}
