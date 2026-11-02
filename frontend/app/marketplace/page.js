
"use client";

import { useEffect, useState } from "react";

function tagClass(status) {
  if (status === "Sold") return "tag sold";
  if (status === "Referred" || status === "Expired") return "tag referred";
  return "tag active";
}

export default function MarketplacePage() {
  const [listings, setListings] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadListings = async (searchTerm = "") => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (searchTerm.trim()) {
        params.set("q", searchTerm.trim());
      }

      const response = await fetch(
        `/api/furniture${params.toString() ? `?${params}` : ""}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load listings");
      } else {
        setListings(data.listings || []);
      }
    } catch {
      setError("Failed to load listings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    await loadListings(search);
  }

  async function handleBuy(listingId, price) {
    setMessage("");
    setError("");

    const res = await fetch(`/api/furniture/${listingId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Purchase failed");
      return;
    }

    setMessage("Purchase successful.");
    await loadListings(search);
  }

  async function clearSearch() {
    setSearch("");
    await loadListings("");
  }

  return (
    <main className="page-container">
      <h1>Furniture Marketplace</h1>

      <p>
        Unsold listings are automatically referred to a junkyard
        partner 90 days after posting.
      </p>

      <form onSubmit={handleSearch}>
        <input
          type="search"
          placeholder="Search furniture by title or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button type="submit">Search</button>

        <button type="button" onClick={clearSearch}>
          Clear
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      {loading ? (
        <p>Loading listings...</p>
      ) : listings.length === 0 ? (
        <p>No furniture listings found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Condition</th>
              <th>Price</th>
              <th>Status</th>
              <th>Seller</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {listings.map((l) => (
              <tr key={l.listing_id}>
                <td>{l.title}</td>
                <td>{l.category}</td>
                <td>{l.condition}</td>
                <td>₹{l.price}</td>
                <td>
                  <span className={tagClass(l.status)}>
                    {l.status}
                  </span>
                </td>
                <td>{l.seller_name}</td>
                <td>
                  {l.status === "Active" && user && (
                    <button onClick={() => handleBuy(l.listing_id, l.price)}>
                      Buy
                    </button>
                  )}

                  {l.status === "Active" && !user && (
                    <a href="/login">Log in to buy</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
