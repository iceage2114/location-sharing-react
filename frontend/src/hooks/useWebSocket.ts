import { useEffect, useRef } from "react";
import { useLocationStore } from "../store/locationStore";
import { useAuthStore } from "../store/authStore";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";

export function useWebSocket(groupId: string | null) {
  const setLocation = useLocationStore((s) => s.setLocation);
  const token = useAuthStore((s) => s.token);
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const stopped = useRef(false);

  useEffect(() => {
    if (!groupId || !token) return;
    stopped.current = false;

    function connect() {
      if (stopped.current) return;
      const ws = new WebSocket(`${WS_BASE}/ws/${groupId}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryDelay.current = 1000;
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "location_update") {
            setLocation(msg.user_id, {
              lat: msg.lat,
              lng: msg.lng,
              accuracy: msg.accuracy,
              displayName: msg.display_name,
              avatarUrl: msg.avatar_url,
              timestamp: msg.updated_at,
            });
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (stopped.current) return;
        setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 30000);
      };
    }

    connect();

    return () => {
      stopped.current = true;
      wsRef.current?.close();
    };
  }, [groupId, token, setLocation]);
}
