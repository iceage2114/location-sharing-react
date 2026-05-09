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
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui,sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: "#fff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>?? Location Sharing</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: 13, color: "#6b7280" }}>{user?.display_name}</p>
        </div>

        {groups.length > 1 && (
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e5e7eb" }}>
            <select
              value={activeGroupId ?? ""}
              onChange={(e) => setActiveGroupId(e.target.value)}
              style={{ width: "100%", padding: "0.4rem", borderRadius: 6, border: "1px solid #d1d5db" }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          <MemberList locations={locations} currentUserId={user?.id} />
        </div>

        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #e5e7eb", display: "flex", gap: "0.5rem" }}>
          <a href="/groups" style={{ flex: 1, textAlign: "center", padding: "0.5rem", borderRadius: 6, background: "#f3f4f6", textDecoration: "none", fontSize: 13, color: "#374151" }}>Groups</a>
          <a href="/profile" style={{ flex: 1, textAlign: "center", padding: "0.5rem", borderRadius: 6, background: "#f3f4f6", textDecoration: "none", fontSize: 13, color: "#374151" }}>Profile</a>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1 }}>
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
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
      </div>
    </div>
  );
}
