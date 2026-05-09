from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.dependencies import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, GoogleAuthRequest, TokenResponse, UserOut, RefreshRequest
from app.services.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_refresh_token, verify_google_token,
)
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])


def _make_tokens(user: User) -> TokenResponse:
    data = {"sub": user.id}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _make_tokens(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return _make_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_refresh_token(body.refresh_token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _make_tokens(user)


@router.post("/google", response_model=TokenResponse)
async def google_auth(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        info = verify_google_token(body.id_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    google_id = info["sub"]
    email = info["email"]

    # Lookup by google_id first
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        # Fallback: look up by email (account linking)
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
            if not user.avatar_url and info.get("picture"):
                user.avatar_url = info["picture"]
        else:
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                google_id=google_id,
                display_name=info["name"],
                avatar_url=info.get("picture"),
            )
            db.add(user)

    await db.commit()
    await db.refresh(user)
    return _make_tokens(user)
