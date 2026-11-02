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

  const loadListings = () => {
    fetch("/api/furniture")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setListings(data.listings);
      })
      .catch(() => setError("Failed to load listings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadListings();
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, []);

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
    loadListings();
  }

  return (
    <div>
      <h1>Furniture Marketplace</h1>
      <p>
        Unsold listings are automatically referred to a junkyard partner 90
        days after posting.
      </p>
      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      {!loading && (
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
                  <span className={tagClass(l.status)}>{l.status}</span>
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
    </div>
  );
}
