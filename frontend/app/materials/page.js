"use client";

import { useEffect, useState } from "react";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/materials")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setMaterials(data.materials);
      })
      .catch(() => setError("Failed to load materials"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Green Material Advisor</h1>
      <p>Green alternatives to traditional building materials, with CO2 and cost impact.</p>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <table>
          <thead>
            <tr>
              <th>Traditional material</th>
              <th>Green alternative</th>
              <th>CO2 reduction</th>
              <th>Cost delta</th>
              <th>Best vendor price</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={`${m.material_id}-${m.traditional_material}`}>
                <td>{m.traditional_material}</td>
                <td>{m.green_material}</td>
                <td>{m.co2_reduction_pct}%</td>
                <td>{m.cost_delta_pct}%</td>
                <td>
                  {m.min_price != null
                    ? `₹${m.min_price} (${m.vendor_name})`
                    : "No vendor pricing yet"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
