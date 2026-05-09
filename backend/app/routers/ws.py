from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth import decode_access_token
from app.services.ws_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{group_id}")
async def websocket_endpoint(group_id: str, ws: WebSocket, token: str = Query(...)):
    payload = decode_access_token(token)
    if not payload:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == payload.get("sub")))
        user = result.scalar_one_or_none()

    if not user:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(group_id, ws)
    try:
        while True:
            # Keep connection alive; actual data flows server?client via broadcast
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(group_id, ws)
