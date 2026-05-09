from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire, "type": "access"})
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload.update({"exp": expire, "type": "refresh"})
    return jwt.encode(payload, settings.JWT_REFRESH_SECRET, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def verify_google_token(token: str) -> dict:
    """Verify Google ID token and return user info dict with sub, email, name, picture."""
    request = google_requests.Request()
    idinfo = id_token.verify_oauth2_token(token, request, settings.GOOGLE_CLIENT_ID)
    return {
        "sub": idinfo["sub"],
        "email": idinfo["email"],
        "name": idinfo.get("name", idinfo["email"].split("@")[0]),
        "picture": idinfo.get("picture"),
    }
