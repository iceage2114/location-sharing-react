import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, googleLogin } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div style={{ maxWidth: 380, width: "100%", margin: "10vh auto", padding: "2rem", fontFamily: "system-ui,sans-serif" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Sign in</h1>
      {error && <p style={{ color: "red", marginBottom: "1rem" }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: "0.6rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 15 }}
        />
        <button
          type="submit"
          style={{ padding: "0.7rem", borderRadius: 6, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
        >
          Sign in
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
        useOneTap
      />
      <p style={{ marginTop: "1.5rem", textAlign: "center", fontSize: 14 }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
