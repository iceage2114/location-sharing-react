# Technical Report: Location Sharing App

## Overview

This app is a real-time group location tracker. Users join groups, share their GPS position, and see other members moving on a live map. The system is split into two independently deployed services: a Python backend and a React frontend, connected over HTTP and WebSockets.

---

## Backend — FastAPI

The backend is built with **FastAPI**, a modern Python web framework designed around Python type hints and asynchronous I/O.

### Request Handling

FastAPI uses **Pydantic** models for request and response validation. When a request arrives at an endpoint, FastAPI automatically parses the JSON body into a typed Python object and validates it before the handler function is called. If validation fails, a 422 response is returned without the handler running at all. This removes the need for manual input validation code.

```python
@router.post("/auth/register")
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    ...
```

`UserCreate` is a Pydantic schema — FastAPI reads the request body, validates it, and injects a fully typed object.

### Dependency Injection

FastAPI has a built-in dependency injection system used via `Depends()`. The app uses this for two things:

- **`get_db`** — opens an async SQLAlchemy session, yields it to the handler, then closes it after the response is sent
- **`get_current_user`** — extracts the JWT from the `Authorization` header, decodes it, and fetches the user from the database

Any route that declares these dependencies gets the correct objects injected automatically. This keeps authentication logic out of individual route handlers.

### Async Database Access

The database layer uses **SQLAlchemy** in async mode with the `asyncpg` driver. Every query uses `await`, meaning the server can handle other requests while waiting for Neon to respond over the network. With Neon's serverless Postgres on a shared connection pool (`pool_size=5`), this keeps the app responsive without needing multiple threads or processes.

### WebSockets

FastAPI supports WebSockets natively. The `/ws/{group_id}` endpoint authenticates the user via a `?token=` query parameter (the browser WebSocket API cannot send custom headers on the initial handshake), then registers the connection in an in-memory `ConnectionManager`:

```python
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}
```

When any group member posts a location update, the locations router calls `manager.broadcast_to_group()`, which fans the message out to every open WebSocket in that group. This happens within the same HTTP request handler — no message broker or background worker is needed.

### Authentication

Auth uses two JWT tokens:

- **Access token** — short-lived (30 min), sent in the `Authorization: Bearer` header on every API request
- **Refresh token** — long-lived (30 days), stored in localStorage, used only to get a new access token when the current one expires

Google Sign-In is handled server-side: the frontend receives a Google ID token via `@react-oauth/google`, sends it to `POST /auth/google`, and the backend verifies it using the `google-auth` library against Google's public keys. The server never trusts claims from the client — it only trusts what Google's verification returns.

---

## Frontend — Vite + React

The frontend is a single-page application scaffolded with **Vite**, which provides near-instant hot module replacement during development and an optimised production build via Rollup.

### Routing

**React Router v6** handles client-side navigation. All routes are defined in `App.tsx`. Protected routes check for a JWT in the Zustand auth store and redirect to `/login` if none is present — no server round-trip needed.

### State Management

**Zustand** manages two stores:

- **`authStore`** — holds the JWT, refresh token, and user object. Uses Zustand's `persist` middleware to write to `localStorage` automatically, so the user stays logged in across page refreshes.
- **`locationStore`** — holds a `Map<userId, MemberLocation>`. It is updated both on initial page load (via a REST fetch of current positions) and in real time (via WebSocket messages). React components subscribe to individual slices of this store and only re-render when their slice changes.

### Real-Time Location Flow

Two custom hooks coordinate location sharing:

**`useLocation`** calls `navigator.geolocation.watchPosition()` with `enableHighAccuracy: true`. Every time the browser reports a new position, it POSTs `{ lat, lng, accuracy, group_id }` to the backend. The browser only fires this while the tab is in the foreground — there is no background tracking in the web platform.

**`useWebSocket`** opens a WebSocket connection to `/ws/{group_id}?token=...`. It listens for `location_update` messages broadcast by the server and writes them directly into `locationStore`. It also implements exponential backoff reconnection — if the connection drops, it retries after 1 s, then 2 s, 4 s, up to a cap of 30 s.

### Map Rendering

**Leaflet** renders the map via the `react-leaflet` bindings. Each member in `locationStore` gets a `<MemberMarker>` component — a Leaflet `Marker` with a custom `DivIcon` showing the member's initials in a coloured circle. When `locationStore` updates, React re-renders only the affected markers rather than the entire map.

OpenStreetMap tiles are used directly, requiring no API key.

### API Layer

All HTTP requests go through a single Axios instance in `services/api.ts`. Two interceptors are attached:

- **Request interceptor** — reads the current access token from `authStore` and attaches it as `Authorization: Bearer ...` to every outgoing request
- **Response interceptor** — catches 401 responses, calls `POST /auth/refresh` with the stored refresh token, updates the store with the new tokens, and retries the original request transparently. If the refresh itself fails, the user is logged out.

---

## Data Flow Summary

```
GPS fix (browser)
  → useLocation hook
    → POST /locations
      → Backend upserts current_location in Neon
      → Backend calls ws_manager.broadcast_to_group()
        → WebSocket message sent to all group members
          → useWebSocket hook receives message
            → locationStore.setLocation() called
              → MemberMarker re-renders at new position
```

---

## Deployment Architecture

```
[Browser]
    │  HTTPS REST + WSS
    ▼
[Fly.io — FastAPI]  ──asyncpg──▶  [Neon — Postgres]
    
[Netlify/Vercel — React SPA]  (static files, no server)
```

The backend runs as a single Fly.io VM. The in-memory `ConnectionManager` is sufficient because all WebSocket connections for a given group land on the same machine. If the app were scaled to multiple VMs, a shared pub/sub layer (e.g. Redis) would be needed to fan out broadcasts across instances.

The frontend is a fully static build (`npm run build` produces a `dist/` folder) deployed to Netlify or Vercel. It has no server component — all logic runs in the browser.
