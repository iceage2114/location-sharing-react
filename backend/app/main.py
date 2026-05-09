import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.database import engine, Base
from app.routers import auth, users, groups, locations, ws

# Import models so Base.metadata is populated
from app.models import user, group, location  # noqa: F401


async def prune_location_history():
    """Background task: delete location history older than 7 days. Runs daily."""
    while True:
        await asyncio.sleep(86400)
        try:
            async with engine.begin() as conn:
                cutoff = datetime.now(timezone.utc) - timedelta(days=7)
                await conn.execute(
                    text("DELETE FROM location_history WHERE timestamp < :cutoff"),
                    {"cutoff": cutoff},
                )
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    task = asyncio.create_task(prune_location_history())
    yield
    task.cancel()


app = FastAPI(title="Location Sharing API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(locations.router)
app.include_router(ws.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/debug/cors")
async def debug_cors():
    return {"allowed_origins": settings.allowed_origins_list}
