# Local Development Setup

Run the app locally using [Neon](https://neon.tech) as the database — no Docker or local Postgres required.

---

## Prerequisites

- Python 3.12+
- Node.js 18+
- A free [Neon](https://neon.tech) account

---

## 1. Get your Neon connection string

1. Sign up at [neon.tech](https://neon.tech) and create a new project
2. In the Neon dashboard, go to **Connection Details** and copy the connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Prepend `+asyncpg` to the scheme so SQLAlchemy can use it:
   ```
   postgresql+asyncpg://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?ssl=require
   ```

---

## 2. Backend

```bash
cd backend
```

**Activate the virtual environment:**

```bash
# Windows:
.venv\Scripts\activate

# macOS/Linux:
source .venv/bin/activate
```

**Install dependencies** (first time only):

```bash
pip install -r requirements.txt
```

**Create your `.env` file:**

```bash
# Windows:
copy .env.example .env

# macOS/Linux:
cp .env.example .env
```

Then edit `backend/.env` and fill in:

```env
DATABASE_URL=postgresql+asyncpg://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?ssl=require
JWT_SECRET=<output of: python -c "import secrets; print(secrets.token_hex(32))">
JWT_REFRESH_SECRET=<output of: python -c "import secrets; print(secrets.token_hex(32))">
ALLOWED_ORIGINS=["http://localhost:5173"]
GOOGLE_CLIENT_ID=<your Google OAuth client ID>
```

Generate secrets quickly:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Start the backend:**

```bash
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`  
Swagger UI at `http://localhost:8000/docs`

> Database tables are created automatically on first startup.

---

## 3. Frontend

```bash
cd frontend
```

**Install dependencies** (first time only):

```bash
npm install
```

**Create your `.env` file:**

```bash
# Windows:
copy .env.example .env

# macOS/Linux:
cp .env.example .env
```

Then edit `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
VITE_GOOGLE_CLIENT_ID=<your Google OAuth client ID>
```

**Start the frontend:**

```bash
npm run dev
```

App available at `http://localhost:5173`

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add `http://localhost:5173` to **Authorized JavaScript origins**
4. Add `http://localhost:5173` to **Authorized redirect URIs**
5. Copy the Client ID into both `.env` files

---

## Verify it works

1. Open `http://localhost:8000/docs` — you should see the Swagger UI with all endpoints
2. Open `http://localhost:5173` — you should see the login page
3. Register an account, create a group, and allow location access in the browser
