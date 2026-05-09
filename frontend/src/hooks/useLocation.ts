import { useEffect, useRef } from "react";
import api from "../services/api";

export function useLocation(groupId: string | null, onFirstFix?: (lat: number, lng: number) => void) {
  const calledFirstFix = useRef(false);

  useEffect(() => {
    if (!groupId) return;
    if (!navigator.geolocation) return;

    calledFirstFix.current = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;

        if (!calledFirstFix.current && onFirstFix) {
          calledFirstFix.current = true;
          onFirstFix(lat, lng);
        }

        api.post("/locations", { lat, lng, accuracy, group_id: groupId }).catch(() => {
          // silently fail — WS will catch next update
        });
      },
      (err) => {
        console.warn("Geolocation error:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [groupId, onFirstFix]);
}
