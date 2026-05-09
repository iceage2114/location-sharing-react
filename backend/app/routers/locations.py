import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.location import CurrentLocation, LocationHistory
from app.schemas.location import LocationUpdate, MemberLocationOut
from app.services.ws_manager import manager
from datetime import datetime, timezone

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("", status_code=204)
async def update_location(
    body: LocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # Upsert current_location
    stmt = pg_insert(CurrentLocation).values(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        group_id=body.group_id,
        lat=body.lat,
        lng=body.lng,
        accuracy=body.accuracy,
        updated_at=now,
    ).on_conflict_do_update(
        constraint="uq_current_location",
        set_={"lat": body.lat, "lng": body.lng, "accuracy": body.accuracy, "updated_at": now},
    )
    await db.execute(stmt)

    # Append history
    history = LocationHistory(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        group_id=body.group_id,
        lat=body.lat,
        lng=body.lng,
        accuracy=body.accuracy,
        timestamp=now,
    )
    db.add(history)
    await db.commit()

    # Broadcast via WebSocket
    await manager.broadcast_to_group(body.group_id, {
        "type": "location_update",
        "user_id": current_user.id,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url,
        "lat": body.lat,
        "lng": body.lng,
        "accuracy": body.accuracy,
        "updated_at": now.isoformat(),
    })


@router.get("/group/{group_id}", response_model=list[MemberLocationOut])
async def get_group_locations(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CurrentLocation, User)
        .join(User, User.id == CurrentLocation.user_id)
        .where(CurrentLocation.group_id == group_id)
    )
    rows = result.all()
    return [
        MemberLocationOut(
            user_id=u.id,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            lat=loc.lat,
            lng=loc.lng,
            accuracy=loc.accuracy,
            updated_at=loc.updated_at,
        )
        for loc, u in rows
    ]
