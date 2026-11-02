
"use client";

import { useEffect, useState } from "react";

export default function AdminPage() {
  const [data, setData] = useState({
    listingsNearingExpiry: [],
    referrals: [],
  });
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadOverview() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/overview");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load overview");
      }

      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runSweep() {
    setSweeping(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/sweep", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Sweep failed");
      }

      setMessage(
        `Sweep completed. ${result.referred} listing(s) referred.`
      );

      await loadOverview();
    } catch (err) {
      setError(err.message);
    } finally {
      setSweeping(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  function formatDate(value) {
    return new Date(value).toLocaleString();
  }

  return (
    <div className="page-container">
      <h1>Admin Dashboard</h1>
      <p>Manage expiring furniture listings and junkyard referrals.</p>

      <section className="card">
        <h2>90-Day Expiry Sweep</h2>
        <p>
          Find active listings that have remained posted for at
          least 90 days and refer them to a junkyard.
        </p>

        <button onClick={runSweep} disabled={sweeping}>
          {sweeping ? "Running sweep..." : "Run 90-day sweep"}
        </button>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>

      <section className="card">
        <h2>Listings Nearing Expiry</h2>

        {loading ? (
          <p>Loading listings...</p>
        ) : data.listingsNearingExpiry.length === 0 ? (
          <p>No listings are currently nearing expiry.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Seller ID</th>
                  <th>Posted At</th>
                  <th>Expires On</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.listingsNearingExpiry.map((listing) => (
                  <tr key={listing.listing_id}>
                    <td>{listing.listing_id}</td>
                    <td>{listing.title}</td>
                    <td>{listing.seller_id}</td>
                    <td>{formatDate(listing.posted_at)}</td>
                    <td>{formatDate(listing.expires_on)}</td>
                    <td>{listing.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Junkyard Referral History</h2>

        {loading ? (
          <p>Loading referrals...</p>
        ) : data.referrals.length === 0 ? (
          <p>No junkyard referrals found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Referral ID</th>
                  <th>Listing ID</th>
                  <th>Listing</th>
                  <th>Junkyard</th>
                  <th>Location</th>
                  <th>Referred At</th>
                </tr>
              </thead>
              <tbody>
                {data.referrals.map((referral) => (
                  <tr key={referral.referral_id}>
                    <td>{referral.referral_id}</td>
                    <td>{referral.listing_id}</td>
                    <td>{referral.listing_title}</td>
                    <td>{referral.junkyard_name}</td>
                    <td>{referral.junkyard_location}</td>
                    <td>{formatDate(referral.referred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
