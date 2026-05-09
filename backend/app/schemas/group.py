from pydantic import BaseModel
from datetime import datetime
from typing import List


class GroupCreate(BaseModel):
    name: str


class GroupOut(BaseModel):
    id: str
    name: str
    invite_code: str
    owner_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    user_id: str
    display_name: str
    avatar_url: str | None = None
    joined_at: datetime

    model_config = {"from_attributes": True}


class GroupWithMembers(GroupOut):
    members: List[MemberOut] = []
