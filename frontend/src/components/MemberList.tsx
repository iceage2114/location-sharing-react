import { MemberLocation } from "../store/locationStore";

interface Props {
  locations: Map<string, MemberLocation>;
  currentUserId?: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function MemberList({ locations, currentUserId }: Props) {
  const entries = Array.from(locations.entries());
  if (entries.length === 0) return <p style={{ padding: "1rem", color: "#6b7280" }}>No members online.</p>;

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: "0.5rem" }}>
      {entries.map(([userId, data]) => (
        <li
          key={userId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.6rem 0.75rem",
            borderRadius: "8px",
            background: userId === currentUserId ? "#eef2ff" : "transparent",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#4f46e5",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {getInitials(data.displayName)}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {data.displayName} {userId === currentUserId && <span style={{ color: "#4f46e5" }}>(you)</span>}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{timeAgo(data.timestamp)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
