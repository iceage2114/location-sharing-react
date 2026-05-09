from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdate(BaseModel):
    display_name: Optional[str] = None


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    await db.commit()
    await db.refresh(current_user)
    return current_user
