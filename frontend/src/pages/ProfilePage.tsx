import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import api from "../services/api";

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      await api.patch("/users/me", { display_name: displayName });
      setSaved(true);
    } catch {
      setError("Failed to save.");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ maxWidth: 420, margin: "2rem auto", padding: "1.5rem", fontFamily: "system-ui,sans-serif" }}>
      <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#4f46e5", marginBottom: "1rem" }}>? Back to map</button>
      <h1 style={{ marginBottom: "1.5rem" }}>Profile</h1>

      <p style={{ color: "#6b7280", fontSize: 14 }}>{user?.email}</p>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Display name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        {saved && <p style={{ color: "green", margin: 0 }}>Saved!</p>}
        {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}
        <button type="submit" style={{ padding: "0.7rem", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Save changes
        </button>
      </form>

      {user?.google_id && (
        <p style={{ marginTop: "1rem", fontSize: 13, color: "#6b7280" }}>Signed in with Google. Password change not available.</p>
      )}

      <button
        onClick={handleLogout}
        style={{ marginTop: "2rem", padding: "0.7rem", width: "100%", borderRadius: 6, background: "#dc2626", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
      >
        Sign out
      </button>
    </div>
  );
}
