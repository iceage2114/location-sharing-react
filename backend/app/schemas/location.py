from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    group_id: str


class MemberLocationOut(BaseModel):
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    lat: float
    lng: float
    accuracy: Optional[float] = None
    updated_at: datetime
