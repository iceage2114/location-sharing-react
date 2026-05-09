from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, group_id: str, ws: WebSocket):
        await ws.accept()
        self.active.setdefault(group_id, []).append(ws)

    def disconnect(self, group_id: str, ws: WebSocket):
        if group_id in self.active:
            self.active[group_id] = [s for s in self.active[group_id] if s is not ws]
            if not self.active[group_id]:
                del self.active[group_id]

    async def broadcast_to_group(self, group_id: str, data: dict):
        sockets = self.active.get(group_id, [])
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(group_id, ws)


manager = ConnectionManager()
