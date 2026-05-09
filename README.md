# Location Sharing App

A Life360-style real-time group location tracker built with FastAPI and React.

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + SQLAlchemy (async) — deployed to Fly.io |
| Database | [Neon](https://neon.tech) (serverless Postgres) |
| Frontend | Vite + React + TypeScript — deployed to Netlify / Vercel |
| Auth | Email/password + Google OAuth → JWT |
| Real-time | WebSockets (FastAPI native) |
| Maps | Leaflet + OpenStreetMap (no API key needed) |
| State | Zustand |
| Migrations | Alembic |

---

## Prerequisites

- Python 3.12+
- Node.js 18+
- A free [Neon](https://neon.tech) account

---

## Database Setup (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a new project
2. In the Neon dashboard, copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Prepend `+asyncpg` to the scheme for SQLAlchemy:
   ```
   postgresql+asyncpg://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?ssl=require
   ```
4. Paste this as `DATABASE_URL` in `backend/.env`

---

## Local Development

### 1. Backend

```bash
cd backend

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL (Neon connection string), JWT_SECRET,
#              JWT_REFRESH_SECRET, and GOOGLE_CLIENT_ID

# Run the dev server
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`  
Swagger UI at `http://localhost:8000/docs`

> Tables are created automatically on first startup — no need to run Alembic migrations locally.

### 2. Frontend

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — set VITE_GOOGLE_CLIENT_ID

# Run the dev server
npm run dev
```

App available at `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon connection string (`postgresql+asyncpg://...?ssl=require`) |
| `JWT_SECRET` | Secret for signing access tokens — use a long random string |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens — use a different long random string |
| `ALLOWED_ORIGINS` | JSON array of allowed CORS origins, e.g. `["http://localhost:5173"]` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID from Google Cloud Console |

Generate secrets:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend HTTP base URL, e.g. `http://localhost:8000` |
| `VITE_WS_URL` | Backend WebSocket base URL, e.g. `ws://localhost:8000` |
| `VITE_GOOGLE_CLIENT_ID` | Same Google OAuth client ID as the backend |

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:5173` to **Authorized JavaScript origins**
4. Add `http://localhost:5173` to **Authorized redirect URIs**
5. Copy the Client ID into both `.env` files

---

## Database Migrations (Alembic)

```bash
cd backend

# Generate a new migration after model changes
alembic revision --autogenerate -m "describe your change"

# Apply migrations
alembic upgrade head

# Roll back one step
alembic downgrade -1
```

---

## Project Structure

```
location-sharing-react/
├── backend/
│   ├── app/
│   │   ├── main.py              # App entry, CORS, lifespan, router registration
│   │   ├── config.py            # Pydantic BaseSettings
│   │   ├── database.py          # Async SQLAlchemy engine
│   │   ├── dependencies.py      # get_db, get_current_user
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # FastAPI routers (auth, users, groups, locations, ws)
│   │   └── services/            # Auth logic, WebSocket connection manager
│   ├── alembic/                 # Migration scripts
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── fly.toml                 # Fly.io deployment config
│   └── .env.example
│
└── frontend/
│   ├── src/
│   │   ├── main.tsx             # Entry point, GoogleOAuthProvider
│   │   ├── App.tsx              # React Router routes
│   │   ├── pages/               # LoginPage, RegisterPage, MapPage, GroupPage, ProfilePage
│   │   ├── components/          # MemberMarker, MemberList
│   │   ├── hooks/               # useWebSocket, useLocation
│   │   ├── store/               # authStore, locationStore (Zustand)
│   │   └── services/            # api.ts (Axios + JWT interceptor)
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── .env.example
```

---

## API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register with email + password |
| POST | `/auth/login` | — | Login with email + password |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/google` | — | Login/register with Google ID token |
| GET | `/users/me` | ✓ | Get current user profile |
| PATCH | `/users/me` | ✓ | Update display name |
| POST | `/groups` | ✓ | Create a group |
| GET | `/groups/me` | ✓ | List groups the user belongs to |
| POST | `/groups/join/{invite_code}` | ✓ | Join a group by invite code |
| DELETE | `/groups/{id}/leave` | ✓ | Leave a group |
| POST | `/locations` | ✓ | Update current location (triggers WS broadcast) |
| GET | `/locations/group/{group_id}` | ✓ | Get latest location for all group members |
| WS | `/ws/{group_id}?token=...` | ✓ | WebSocket stream for real-time location updates |

---

## Deployment

### Backend → Fly.io

```bash
cd backend

# First-time setup
fly launch

# Set production secrets
fly secrets set \
  DATABASE_URL="postgresql+asyncpg://...?ssl=require" \
  JWT_SECRET="..." \
  JWT_REFRESH_SECRET="..." \
  GOOGLE_CLIENT_ID="..." \
  ALLOWED_ORIGINS='["https://your-app.netlify.app"]'

# Deploy
fly deploy
```

### Frontend → Netlify / Vercel

```bash
cd frontend
npm run build
# Deploy the dist/ folder
```

Set these environment variables in your hosting dashboard:

```
VITE_API_URL=https://your-api.fly.dev
VITE_WS_URL=wss://your-api.fly.dev
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

After deploying, add your production frontend URL to the **Authorized JavaScript origins** in Google Cloud Console.

---

## How It Works

```
Browser tab (must stay open — no background tracking in web)
  └─ navigator.geolocation.watchPosition fires on movement
       └─ POST /locations  { lat, lng, accuracy, group_id }
            └─ Backend upserts current_location row in Neon
            └─ Backend broadcasts via WebSocket to all group members
                 └─ locationStore updated → Leaflet markers re-render
```

Location history older than 7 days is pruned automatically by a daily background task to stay within Neon's 0.5 GB free tier limit.
