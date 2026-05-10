import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "../store/authStore";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const { register, googleLogin } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await register(email, password, displayName);
      navigate("/");
    } catch {
      setError("Registration failed. Email may already be in use.");
    }
  }

  return (
    <div style={{ maxWidth: 380, width: "100%", margin: "10vh auto", padding: "2rem", fontFamily: "system-ui,sans-serif" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Create account</h1>
      {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ padding: "0.6rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        <button
          type="submit"
          style={{ padding: "0.7rem", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Register
        </button>
      </form>
      <div style={{ margin: "1rem 0", textAlign: "center", color: "#6b7280" }}>or</div>
      <GoogleLogin
        onSuccess={async (cred) => {
          if (!cred.credential) return;
          try {
            await googleLogin(cred.credential);
            navigate("/");
          } catch {
            setError("Google sign-in failed.");
          }
        }}
        onError={() => setError("Google sign-in failed.")}
      />
      <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 14 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
