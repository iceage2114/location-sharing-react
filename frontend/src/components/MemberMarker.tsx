import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { MemberLocation } from "../store/locationStore";

interface Props {
  userId: string;
  data: MemberLocation;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

function createDivIcon(initials: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:#4f46e5;color:#fff;font-size:13px;font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);
      font-family:system-ui,sans-serif;
    ">${initials}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

export default function MemberMarker({ userId: _userId, data }: Props) {
  const initials = getInitials(data.displayName);
  return (
    <Marker position={[data.lat, data.lng]} icon={createDivIcon(initials)}>
      <Popup>
        <strong>{data.displayName}</strong>
        <br />
        <span style={{ color: "#6b7280", fontSize: "12px" }}>{timeAgo(data.timestamp)}</span>
      </Popup>
    </Marker>
  );
}
