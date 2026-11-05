
"use client";

import { useEffect, useState } from "react";

export default function VendorPage() {
  const [listings, setListings] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState({
    material_id: "",
    price: "",
    url: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);

    try {
      const [listingResponse, materialResponse] = await Promise.all([
        fetch("/api/vendor/listings"),
        fetch("/api/materials"),
      ]);

      const listingData = await listingResponse.json();
      const materialData = await materialResponse.json();

      if (!listingResponse.ok) {
        setMessage(listingData.error || "Unable to load vendor listings");
        setListings([]);
      } else {
        setListings(listingData.listings || []);
      }

      if (materialResponse.ok) {
        setMaterials(
          Array.isArray(materialData)
            ? materialData
            : materialData.materials || []
        );
      }
    } catch {
      setMessage("Unable to connect to the server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateForm(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/vendor/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not create listing");
        return;
      }

      setMessage("Vendor listing created successfully");
      setForm({ material_id: "", price: "", url: "" });
      await loadData();
    } catch {
      setMessage("Unable to connect to the server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-container">
      <h1>Vendor Dashboard</h1>
      <p>Manage your green material listings.</p>

      <section className="card">
        <h2>Add Material Listing</h2>

        <form onSubmit={handleSubmit}>
          <label htmlFor="material_id">Material</label>
          <select
            id="material_id"
            name="material_id"
            value={form.material_id}
            onChange={updateForm}
            required
          >
            <option value="">Select a material</option>
            {materials.map((material) => (
              <option key={material.material_id} value={material.material_id}>
                {material.name} ({material.category})
              </option>
            ))}
          </select>

          <label htmlFor="price">Price</label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={updateForm}
            placeholder="Enter price"
            required
          />

          <label htmlFor="url">Product URL (optional)</label>
          <input
            id="url"
            name="url"
            type="url"
            value={form.url}
            onChange={updateForm}
            placeholder="https://example.com/product"
          />

          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Listing"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}
      </section>

      <section className="card">
        <h2>Your Listings</h2>

        {loading ? (
          <p>Loading listings...</p>
        ) : listings.length === 0 ? (
          <p>No listings found for your vendor account.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Product URL</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => (
                  <tr key={listing.listing_id}>
                    <td>{listing.material_name}</td>
                    <td>{listing.category}</td>
                    <td>{listing.price}</td>
                    <td>
                      {listing.url ? (
                        <a href={listing.url} target="_blank" rel="noreferrer">
                          View Product
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {new Date(listing.last_synced).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
