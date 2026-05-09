import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

interface Group {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  members: Array<{ user_id: string; display_name: string; joined_at: string }>;
}

export default function GroupPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const navigate = useNavigate();

  async function loadGroups() {
    const res = await api.get("/groups/me");
    setGroups(res.data);
  }

  useEffect(() => {
    loadGroups();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await api.post("/groups", { name: newGroupName.trim() });
      setNewGroupName("");
      await loadGroups();
    } catch {
      setError("Failed to create group.");
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      await api.post(`/groups/join/${joinCode.trim()}`);
      setJoinCode("");
      await loadGroups();
    } catch {
      setError("Invalid invite code.");
    }
  }

  async function handleLeave(groupId: string) {
    await api.delete(`/groups/${groupId}/leave`);
    await loadGroups();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  const inputStyle = { padding: "0.55rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, flex: 1 };
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: "0.55rem 1rem", borderRadius: 6, background: color, color: "#fff", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer",
  });

  return (
    <div style={{ maxWidth: 560, margin: "2rem auto", padding: "1.5rem", fontFamily: "system-ui,sans-serif" }}>
      <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#4f46e5", marginBottom: "1rem" }}>? Back to map</button>
      <h1 style={{ marginBottom: "1.5rem" }}>Groups</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input style={inputStyle} placeholder="New group name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} required />
        <button type="submit" style={btnStyle("#4f46e5")}>Create</button>
      </form>

      <form onSubmit={handleJoin} style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
        <input style={inputStyle} placeholder="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} required />
        <button type="submit" style={btnStyle("#059669")}>Join</button>
      </form>

      {groups.map((g) => (
        <div key={g.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 16 }}>{g.name}</strong>
            <button onClick={() => handleLeave(g.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>Leave</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <code style={{ background: "#f3f4f6", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: 13 }}>{g.invite_code}</code>
            <button onClick={() => copyCode(g.invite_code)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#4f46e5" }}>
              {copied === g.invite_code ? "Copied!" : "Copy"}
            </button>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: 13, color: "#6b7280" }}>Members ({g.members.length})</p>
            {g.members.map((m) => (
              <div key={m.user_id} style={{ fontSize: 14, padding: "0.2rem 0" }}>{m.display_name}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
