import { useCallback, useRef, useState, useEffect } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { Map as LeafletMap } from "leaflet";
import { useAuthStore } from "../store/authStore";
import { useLocationStore } from "../store/locationStore";
import { useWebSocket } from "../hooks/useWebSocket";
import { useLocation } from "../hooks/useLocation";
import MemberMarker from "../components/MemberMarker";
import MemberList from "../components/MemberList";
import api from "../services/api";
import "leaflet/dist/leaflet.css";

export default function MapPage() {
  const user = useAuthStore((s) => s.user);
  const locations = useLocationStore((s) => s.locations);
  const setLocations = useLocationStore((s) => s.setLocations);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    api.get("/groups/me").then((res) => {
      setGroups(res.data);
      if (res.data.length > 0) setActiveGroupId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!activeGroupId) return;
    api.get(`/locations/group/${activeGroupId}`).then((res) => {
      setLocations(
        res.data.map((m: { user_id: string; display_name: string; avatar_url?: string; lat: number; lng: number; accuracy?: number; updated_at: string }) => ({
          userId: m.user_id,
          displayName: m.display_name,
          avatarUrl: m.avatar_url,
          lat: m.lat,
          lng: m.lng,
          accuracy: m.accuracy,
          timestamp: m.updated_at,
        }))
      );
    });
  }, [activeGroupId, setLocations]);

  useWebSocket(activeGroupId);

  const handleFirstFix = useCallback(
    (lat: number, lng: number) => {
      mapRef.current?.flyTo([lat, lng], 15);
    },
    []
  );

  useLocation(activeGroupId, handleFirstFix);

  return (
    <div style={{ position: "relative", height: "100vh", width: "100vw", fontFamily: "system-ui,sans-serif", overflow: "hidden" }}>

      {/* Full-screen map always behind everything */}
      <MapContainer
        center={[40.7128, -74.006]}
        zoom={12}
        style={{ height: "100%", width: "100%", position: "absolute", inset: 0 }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {Array.from(locations.entries()).map(([userId, data]) => (
          <MemberMarker key={userId} userId={userId} data={data} />
        ))}
      </MapContainer>

      {/* Backdrop — tap to close sidebar */}
      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{
            position: "absolute", inset: 0, zIndex: 1001,
            background: "rgba(0,0,0,0.35)",
          }}
        />
      )}

      {/* Collapsible left sidebar */}
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: 280,
        zIndex: 1002,
        background: "#fff",
        boxShadow: sheetOpen ? "4px 0 20px rgba(0,0,0,0.18)" : "none",
        display: "flex", flexDirection: "column",
        transform: sheetOpen ? "translateX(0)" : "translateX(-280px)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: "1rem",
          borderBottom: "1px solid #e5e7eb",
          display: "flex", flexDirection: "column", gap: "0.25rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Location Share</span>
            <button
              onClick={() => setSheetOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6b7280", lineHeight: 1, padding: "0 0.25rem" }}
              aria-label="Close sidebar"
            >
              x
            </button>
          </div>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{user?.display_name}</span>
        </div>

        {/* Group selector */}
        {groups.length > 1 && (
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
            <select
              value={activeGroupId ?? ""}
              onChange={(e) => setActiveGroupId(e.target.value)}
              style={{ width: "100%", padding: "0.4rem", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14 }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}
        {groups.length === 1 && (
          <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#374151" }}>
            {groups[0]?.name}
          </div>
        )}

        {/* Member list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <MemberList locations={locations} currentUserId={user?.id} />
        </div>

        {/* Nav links */}
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #e5e7eb", display: "flex", gap: "0.5rem" }}>
          <a href="/groups" style={{
            flex: 1, textAlign: "center", padding: "0.55rem",
            borderRadius: 6, background: "#f3f4f6",
            textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#374151",
          }}>Groups</a>
          <a href="/profile" style={{
            flex: 1, textAlign: "center", padding: "0.55rem",
            borderRadius: 6, background: "#f3f4f6",
            textDecoration: "none", fontSize: 14, fontWeight: 600, color: "#374151",
          }}>Profile</a>
        </div>
      </div>

      {/* Hamburger toggle button — always visible */}
      <button
        onClick={() => setSheetOpen((o) => !o)}
        style={{
          position: "absolute", top: 12, left: 12, zIndex: 1003,
          width: 44, height: 44,
          background: "rgba(255,255,255,0.95)", backdropFilter: "blur(6px)",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 5,
          cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
        aria-label="Toggle sidebar"
      >
        <span style={{ display: "block", width: 20, height: 2, background: "#374151", borderRadius: 1 }} />
        <span style={{ display: "block", width: 20, height: 2, background: "#374151", borderRadius: 1 }} />
        <span style={{ display: "block", width: 20, height: 2, background: "#374151", borderRadius: 1 }} />
      </button>

    </div>
  );
}
