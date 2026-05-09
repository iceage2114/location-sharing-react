# Location Sharing App — Build Plan

A Life360-style group location tracker built with FastAPI (backend) and Vite + React SPA (frontend), deployable on Fly.io free tier (backend) and Netlify/Vercel (frontend), with a Neon Postgres database.

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend | FastAPI + SQLAlchemy async | Deployed to Fly.io |
| Database | Neon (serverless Postgres) | Free tier, 0.5GB, never pauses |
| Frontend | Vite + React (SPA), TypeScript | Deployed to Netlify or Vercel |
| Auth | Google OAuth + email/password → JWT | `@react-oauth/google` + `google-auth` server-side |
| Real-time | WebSockets (FastAPI native) | In-memory connection manager |
| Maps | Leaflet via `react-leaflet` | OpenStreetMap tiles, no API key needed |
| State | Zustand | Lightweight, map-friendly |
| Migrations | Alembic | Pairs with SQLAlchemy |

---

## Project Structure

```
location-sharing-app/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Entry point, CORS, router registration, lifespan
│   │   ├── config.py                # Pydantic BaseSettings reading from .env; adds GOOGLE_CLIENT_ID
│   │   ├── database.py              # Async SQLAlchemy engine (asyncpg), session factory
│   │   ├── dependencies.py          # get_db, get_current_user
│   │   ├── models/
│   │   │   ├── user.py              # Adds google_id (nullable, unique); hashed_password nullable
│   │   │   ├── group.py             # Group + GroupMember association table
│   │   │   └── location.py          # current_location (upsert) + location_history
│   │   ├── schemas/
│   │   │   ├── user.py              # Adds GoogleAuthRequest
│   │   │   ├── group.py
│   │   │   └── location.py
│   │   ├── routers/
│   │   │   ├── auth.py              # /auth/register, /auth/login, /auth/refresh, /auth/google
│   │   │   ├── users.py             # /users/me
│   │   │   ├── groups.py            # CRUD + invite code join
│   │   │   ├── locations.py         # POST current location, GET group locations
│   │   │   └── ws.py                # WebSocket /ws/{group_id}?token=...
│   │   └── services/
│   │       ├── auth.py              # JWT creation/validation + verify_google_token()
│   │       └── ws_manager.py        # ConnectionManager class
│   ├── alembic/
│   ├── requirements.txt             # Adds google-auth
│   ├── Dockerfile
│   ├── fly.toml
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                 # App entry, GoogleOAuthProvider wrapper
│   │   ├── App.tsx                  # React Router v6 routes
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx        # Email/password form + Google button
│   │   │   ├── RegisterPage.tsx     # Email/password form + Google button
│   │   │   ├── MapPage.tsx          # Main Leaflet map view
│   │   │   ├── GroupPage.tsx        # Group management
│   │   │   └── ProfilePage.tsx
│   │   ├── components/
│   │   │   ├── MemberMarker.tsx     # Custom Leaflet DivIcon marker (initials circle)
│   │   │   └── MemberList.tsx       # Sidebar member list
│   │   ├── hooks/
│   │   │   ├── useLocation.ts       # navigator.geolocation.watchPosition + POST
│   │   │   └── useWebSocket.ts      # WS client + exponential backoff reconnect
│   │   ├── store/
│   │   │   ├── authStore.ts         # Zustand + localStorage persistence
│   │   │   └── locationStore.ts     # Map<userId, {lat, lng, displayName, avatarUrl, timestamp}>
│   │   └── services/
│   │       └── api.ts               # Axios: JWT interceptor, 401 refresh retry
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── docker-compose.yml               # Local Postgres only (for dev)
```

---

## Phase 1 — Project Scaffolding

1. Create root `backend/` and `frontend/` directories
2. Backend: init Python venv, `requirements.txt`, `.env.example`
3. Frontend: `npm create vite@latest frontend -- --template react-ts`, install deps

---

## Phase 2 — Backend: Database Models & Config

4. **`config.py`** — Pydantic `BaseSettings` reading from `.env` (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, **`GOOGLE_CLIENT_ID`**)
5. **`database.py`** — async SQLAlchemy engine using `asyncpg`, `pool_size=5` for Neon free tier connection limits
6. **`models/user.py`** — `id`, `email`, `hashed_password` **(nullable — Google users have no password)**, `display_name`, `avatar_url`, `google_id` **(nullable, unique)**, `created_at`
7. **`models/group.py`** — `Group` table + `GroupMember` association table; `invite_code` (random short string) on Group
8. **`models/location.py`** — Two tables:
   - `current_location` — one upserted row per user per group (fast reads for map)
   - `location_history` — append-only, pruned to 7 days (stays within Neon 0.5GB)
9. Alembic init + generate initial migration

---

## Phase 3 — Backend: Auth (Google + email/password)

10. **`schemas/user.py`** — `UserCreate`, `UserLogin`, `UserOut`, `TokenResponse`, **`GoogleAuthRequest` (`{ id_token: str }`)**
11. **`services/auth.py`** — `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token`, **`verify_google_token(id_token)`** — uses `google-auth` (`google.oauth2.id_token.verify_oauth2_token`) to validate and extract `sub`, `email`, `name`, `picture`
12. **`dependencies.py`** — `get_db` (async session), `get_current_user` (validates JWT from `Authorization: Bearer` header)
13. **`routers/auth.py`**:
    - `POST /auth/register` — email/password
    - `POST /auth/login` — email/password
    - `POST /auth/refresh`
    - **`POST /auth/google`** — verifies Google ID token server-side, upserts user (lookup by `google_id` first, then `email` fallback, then create), returns JWT pair

---

## Phase 4 — Backend: Core Routers

14. **`schemas/group.py`**, **`schemas/location.py`**
15. **`routers/users.py`** — `GET /users/me`, `PATCH /users/me` (update display name)
16. **`routers/groups.py`** — `POST /groups`, `GET /groups/me`, `POST /groups/join/{invite_code}`, `DELETE /groups/{id}/leave`
17. **`routers/locations.py`** — `POST /locations` (upsert current + append history), `GET /locations/group/{group_id}` (latest position per member)
18. **`main.py`** — CORS middleware, router registration, lifespan hook to create DB tables, daily background task to prune old location history

---

## Phase 5 — Backend: WebSocket

19. **`services/ws_manager.py`** — `ConnectionManager` class:
    ```python
    class ConnectionManager:
        def __init__(self):
            self.active: dict[str, list[WebSocket]] = {}  # group_id → sockets

        async def connect(self, group_id: str, ws: WebSocket): ...
        async def disconnect(self, group_id: str, ws: WebSocket): ...
        async def broadcast_to_group(self, group_id: str, data: dict): ...
    ```
20. **`routers/ws.py`** — `WS /ws/{group_id}?token=...`
    - Auth via query param (WS handshake can't carry custom headers)
    - Validates JWT on connect, adds socket to manager
    - `POST /locations` calls `broadcast_to_group` after upsert so all connected group members receive the update

---

## Phase 6 — Backend: Deployment Prep

21. **`Dockerfile`** — `python:3.12-slim`, installs deps, runs `uvicorn app.main:app --host 0.0.0.0 --port 8080`
22. **`fly.toml`**:
    ```toml
    [http_service]
      internal_port = 8080
      force_https = true

    [[vm]]
      memory = "256mb"
      cpu_kind = "shared"
      cpus = 1
    ```
23. **Location pruning** — FastAPI startup background task: `DELETE FROM location_history WHERE timestamp < NOW() - INTERVAL '7 days'` runs daily

---

## Phase 7 — Frontend: Setup & Auth

24. Install deps:
    ```
    react-router-dom
    leaflet
    react-leaflet
    @types/leaflet
    zustand
    axios
    @react-oauth/google
    ```
25. **`services/api.ts`** — Axios instance with `baseURL` from env; request interceptor attaches JWT; 401 response interceptor calls refresh and retries original request
26. **`store/authStore.ts`** — Zustand with `persist` middleware to `localStorage`; `token`, `user`, `login()`, `googleLogin()`, `logout()`, `refreshToken()`
27. **`main.tsx`** — wrap app in `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>`
28. **`pages/LoginPage.tsx`** + **`pages/RegisterPage.tsx`**:
    - Email/password form calling `/auth/login` or `/auth/register`
    - `<GoogleLogin onSuccess={cred => POST /auth/google with cred.credential} />` button

---

## Phase 8 — Frontend: Map Screen

28. **`store/locationStore.ts`** — Zustand: `Map<userId, {lat, lng, displayName, avatarUrl, timestamp}>` driving map re-renders
29. **`hooks/useWebSocket.ts`** — connects to `/ws/{group_id}?token=...`, parses JSON messages, writes to `locationStore`; exponential backoff reconnect on disconnect
30. **`hooks/useLocation.ts`** — `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`, `maximumAge: 0`; POSTs to `/locations` on each update; calls `clearWatch()` on cleanup. **Note: no background tracking in browser — tab must remain open**
31. **`components/MemberMarker.tsx`** — Leaflet `Marker` with custom `DivIcon` (initials circle), `Popup` showing display name and "X min ago" last-seen timestamp
32. **`pages/MapPage.tsx`** — `<MapContainer>` with `<TileLayer>` (OpenStreetMap), renders a `<MemberMarker>` per user in `locationStore`; `flyTo` current user's position on first GPS fix; initializes `useLocation` + `useWebSocket` hooks

---

## Phase 9 — Frontend: Group & Profile Screens

33. **`components/MemberList.tsx`** — scrollable list of group members with avatar, name, and last-seen time
34. **`pages/GroupPage.tsx`** — create group form, display `invite_code` (copyable), join-by-code input, member list, leave group button
35. **`pages/ProfilePage.tsx`** — edit display name, view email, logout button; hide password-change section for Google-auth users (`google_id` is set)

---

## Phase 10 — Local Dev & Final Wiring

36. **`docker-compose.yml`** — Postgres only for local dev
37. **`.env.example`** (backend): `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, `GOOGLE_CLIENT_ID`
38. **`.env.example`** (frontend): `VITE_API_URL`, `VITE_WS_URL`, `VITE_GOOGLE_CLIENT_ID`

---

## Data Flow

```
Browser tab (foreground only — tab must remain open)
  → navigator.geolocation.watchPosition fires
  → POST /locations  { lat, lng, accuracy, group_id }
  → Backend upserts current_location + appends location_history
  → Backend calls ws_manager.broadcast_to_group(group_id, payload)
  → All WebSocket clients in that group receive the update
  → locationStore updated → Leaflet MemberMarkers re-render
```

---

## Deployment

```bash
# Backend
cd backend
fly launch          # first time setup
fly deploy          # subsequent deploys

# Set secrets on Fly.io
fly secrets set DATABASE_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... GOOGLE_CLIENT_ID=...

# Frontend — static build
cd frontend
npm run build
# Deploy dist/ to Netlify or Vercel
# Set env vars: VITE_API_URL, VITE_WS_URL, VITE_GOOGLE_CLIENT_ID
```

---

## Verification Checklist

- [ ] Hit `/docs` (FastAPI Swagger UI) and manually test all endpoints including `POST /auth/google`
- [ ] Verify Google login creates a new user on first call, retrieves existing on subsequent calls
- [ ] Verify email/password register + login still works independently
- [ ] Use `wscat` or Postman WebSocket to verify `/ws/{group_id}` broadcasts on `POST /locations`
- [ ] Open two browser tabs as two different users in the same group — verify each sees the other's marker move on the Leaflet map
- [ ] Check browser DevTools → Application → localStorage — confirm tokens persist and refresh correctly on 401
- [ ] Deploy backend to Fly.io and frontend to Netlify/Vercel; confirm CORS and WebSocket work across domains

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Single Fly.io VM | In-memory `ConnectionManager` is sufficient; no Redis needed unless scaling |
| Location upsert (1 row per user per group) | Fast reads for the map view |
| History table pruned to 7 days | Stays within Neon's 0.5GB free tier |
| WS auth via `?token=` query param | Browser WS API cannot send custom headers on handshake |
| Google ID token verified server-side | Never trust the client; `google-auth` verifies signature + expiry |
| `hashed_password` nullable | Google-only users have no password to store |
| Google upsert: `google_id` → `email` → create | Handles account linking if user registered with email first |
| OpenStreetMap tiles via Leaflet | Free, no API key required |
| No background location | Web platform limitation; `navigator.geolocation` only runs while tab is open |
| Frontend on Netlify/Vercel | Static build; simpler than serving from Fly.io |
| Initials-based avatars in v1 | Avoids needing file storage (e.g. Cloudinary) |

---

## Open Questions

1. **Group size limit** — Hard cap (e.g. 10 members) to stay safely within free tier, or leave open?
2. **Location update frequency** — Distance-based (`watchPosition` fires on meaningful movement) is recommended; timer-based polling is an alternative. Which do you prefer?
3. **Account linking** — If a user registered with email/password and later signs in with Google using the same email, should they be merged automatically (current plan) or treated as separate accounts?
4. **Avatar photos** — Start with initials only, or include photo upload in v1 (requires a free file storage service like Cloudinary)?
