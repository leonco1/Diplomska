# Agent Instructions for StreamApp

**StreamApp** is a thesis project: a full-stack video streaming web app with an AI support chatbot.

See [README.md](./README.md) for project overview, setup, and API reference.

## Architecture at a glance

- **Frontend** — React + Vite (TypeScript), Vite proxy routes `/videos` and `/chat` to backend
- **Backend** — NestJS (TypeScript), two main modules: `videos` (upload, stream) and `chat` (OpenAI SSE bot)
- **Database** — PostgreSQL via TypeORM, runs in Docker (`docker-compose.yml`)
- **Storage** — uploaded video files stored as regular files in `backend/uploads/` (gitignored)

**Two dev servers:**
- Backend: `http://localhost:3000` (NestJS dev watcher)
- Frontend: `http://localhost:5173` (Vite dev server with API proxy)

## Building and running

### Backend

```bash
cd backend
npm install
npm run db:up          # Start PostgreSQL container (docker-compose)
npm run start:dev      # Run dev server with watch (port 3000)
npm run build          # Compile to dist/
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # Vite dev server (port 5173)
npm run build          # Build for production (dist/)
```

### Database

```bash
cd backend
npm run db:up          # Start (background)
npm run db:down        # Stop
```

**Postgres runs in Docker:** `docker-compose.yml` configures a single `postgres:16-alpine` service. Tables auto-create from TypeORM entities on first run (`synchronize: true` in `app.module.ts`).

## Key files and module structure

### Backend structure

```
backend/
├── src/
│   ├── main.ts                    # Bootstrap: enables CORS, validates input, creates uploads/ dir
│   ├── app.module.ts              # App imports videos + chat modules, configures TypeORM
│   ├── videos/
│   │   ├── videos.module.ts       # Imports TypeOrmModule.forFeature([Video])
│   │   ├── videos.controller.ts   # POST upload, GET list, GET :id, GET :id/stream (range), DELETE
│   │   ├── videos.service.ts      # Video CRUD, file path utility
│   │   ├── video.entity.ts        # TypeORM entity for videos table
│   │   └── dto/create-video.dto.ts
│   └── chat/
│       ├── chat.module.ts
│       ├── chat.controller.ts     # POST /chat → streams OpenAI response as SSE
│       ├── chat.service.ts        # Calls OpenAI API with system prompt (support bot)
│       └── chat.dto.ts            # ChatMessage[] input validation
├── .env                           # Local config (OPENAI_API_KEY, DB_* vars)
├── .env.example                   # Template
├── docker-compose.yml             # Postgres service
├── uploads/                       # Video files (created on demand, gitignored)
└── dist/                          # Compiled JS (gitignored)
```

### Frontend structure

```
frontend/
├── src/
│   ├── main.tsx                   # React entry, Router setup
│   ├── App.tsx                    # Route shell, ChatWidget placement
│   ├── api.ts                     # fetch() wrappers: listVideos, uploadVideo, streamChat (SSE)
│   ├── pages/
│   │   ├── HomePage.tsx           # /   – Catalog grid of videos
│   │   ├── WatchPage.tsx          # /watch/:id – Video player
│   │   └── UploadPage.tsx         # /upload – Upload form with progress
│   ├── components/
│   │   └── ChatWidget.tsx         # Floating chat panel, SSE streaming, message list
│   ├── index.css                  # Styles (dark theme)
│   └── vite-env.d.ts
├── vite.config.ts                 # Dev proxy: /videos/ and /chat/ → backend
├── tsconfig.json
└── dist/                          # Built output (gitignored)
```

## Important conventions and patterns

### HTTP Range Requests for video seeking

**File:** `backend/src/videos/videos.controller.ts` — `stream()` method.

The `/videos/:id/stream` endpoint:
1. Parses `Range: bytes=START-END` header
2. Returns `206 Partial Content` with `Content-Range`, `Accept-Ranges: bytes` headers
3. Uses `fs.createReadStream(path, {start, end})` to serve only the requested byte range

This is **required for seeking/scrubbing** in the HTML5 video player. Without it, the player can't jump to arbitrary timestamps.

**Testing:** `curl -H "Range: bytes=0-1023" http://localhost:3000/videos/<id>/stream` should return `206`.

### Server-Sent Events (SSE) for the chatbot

**File:** `backend/src/chat/chat.controller.ts` — `send()` method.

The `/chat` endpoint:
1. Sets `Content-Type: text/event-stream`
2. Calls OpenAI with `stream: true`
3. Iterates token chunks and writes `data: {...}\n\n` for each

**Frontend:** `api.ts` — `streamChat()` reads the SSE stream line-by-line.

The format: `data: {"text":"..."}\n\n` for tokens, `data: {"done":true}\n\n` at the end.

### Authentication & authorization (Keycloak)

**Identity provider:** Keycloak, run as the `keycloak` service in `backend/docker-compose.yml` (started by `npm run db:up`). It auto-imports `backend/keycloak/realm-streamapp.json` on first start: realm `streamapp`, public SPA client `streamapp-frontend`, realm roles `admin`/`user`, and seed users `admin/admin` (admin) + `user/user`. Admin console at `http://localhost:8081` (`admin/admin`).

**Backend validation:** `backend/src/auth/`. `JwtStrategy` (passport-jwt + `jwks-rsa`) validates the bearer token's signature against Keycloak's JWKS endpoint, plus `issuer`/`audience`, then JIT-provisions a local `User` via `UsersService.upsertFromToken`. `JwtAuthGuard` is a **global** guard (`APP_GUARD`), so every endpoint needs a valid token unless decorated `@Public()` — only `GET /videos/:id/stream` is public (an HTML5 `<video src>` can't attach an `Authorization` header). `RolesGuard` + `@Roles('admin')` gate `POST /videos` and `DELETE /videos/:id`. Use `@CurrentUser()` to inject the local user + roles into a handler.

**Per-user data:** `backend/src/users/` — `User` (mirrors Keycloak `sub`), `VideoView` (watch history, 1 row per user+video), `EmotionSample` (emotion readings tied to a watched video). Endpoints: `GET /me`, `GET /me/history`, `POST /me/history`, `POST /me/emotions`, `GET /me/videos/:videoId/emotions`.

**Frontend:** `frontend/src/auth/` — `keycloak.ts` (singleton) + `AuthProvider.tsx` (`onLoad: 'login-required'`, wraps the app in `main.tsx`). `api.ts`'s `authFetch` refreshes + attaches the bearer token on every call. `useAuth()` gives `authenticated`/`username`/`roles`/`login`/`logout`; the Upload route is admin-only.

**Token `aud` gotcha:** Keycloak access tokens default to `aud: "account"` (hence `KEYCLOAK_AUDIENCE=account`). If you change client/mappers and requests start returning 401, decode a real token and set `KEYCLOAK_AUDIENCE` to its actual `aud`.

### TypeORM synchronization vs. migrations

**Configured:** `synchronize: true` in `app.module.ts`. This auto-creates/updates tables from entities on startup.

**Why:** Perfect for a thesis demo; zero migration boilerplate.

**Gotcha:** Don't use in production. Use TypeORM migrations instead (`typeorm migration:generate`, etc.) or switch to a different approach if you need schema versioning.

### Video upload with Multer

**File:** `backend/src/videos/videos.controller.ts` — `create()` method.

Configuration:
- Disk storage: files go to `backend/uploads/<random>.<ext>`
- Size limit: `MAX_UPLOAD_BYTES` env var (default 500 MB)
- MIME filter: only `video/*` allowed
- Filename: random hex + original extension to avoid collisions

### ChatBot is a support assistant, not content-aware

**File:** `backend/src/chat/chat.service.ts` — `SUPPORT_SYSTEM_PROMPT`.

The system prompt instructs the bot to help with app usage (how to upload, formats, playback, troubleshooting), not analyze video content. The OpenAI API key **stays server-side** and is never sent to the browser.

## Environment variables

### Backend (`.env`)

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=streamapp
DB_PASSWORD=streamapp
DB_NAME=streamapp

OPENAI_API_KEY=sk-...          # Required for chatbot to work
OPENAI_MODEL=gpt-4o-mini

PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
MAX_UPLOAD_BYTES=524288000      # 500 MB default

# Keycloak (auth) — see "Authentication" below
KEYCLOAK_ISSUER=http://localhost:8081/realms/streamapp
KEYCLOAK_JWKS_URI=http://localhost:8081/realms/streamapp/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=account
```

### Frontend (`.env`)

```
VITE_KEYCLOAK_URL=http://localhost:8081
VITE_KEYCLOAK_REALM=streamapp
VITE_KEYCLOAK_CLIENT_ID=streamapp-frontend
```

**Setup:**
1. Copy `.env.example` to `.env`
2. Add your OpenAI API key (get one at https://platform.openai.com/api-keys)
3. Leave other vars as-is for local dev (they match `docker-compose.yml`)

## Common tasks for agents

### Add a new video endpoint

1. Add a method to `VideosService` (e.g., `async deleteVideo()`)
2. Add a route handler to `VideosController` (e.g., `@Delete(':id')`)
3. Test locally: `curl -X DELETE http://localhost:3000/videos/<id>`

### Debug the video player

- **No video appears:** Check browser network tab — is the `/videos/:id/stream` request succeeding?
- **Can't seek/scrub:** Confirm the response includes `Content-Range` and `Accept-Ranges: bytes` headers. If not, the server isn't handling `Range` headers.
- **Upload fails:** Check the console for validation errors. File size under 500 MB? MIME type `video/*`?

### Add a new chatbot capability

1. Edit `SUPPORT_SYSTEM_PROMPT` in `chat.service.ts` to teach the bot about the new feature
2. Test: send a chat message to http://localhost:3000/chat via `/videos` upload form

### Modify the styling

Edit `frontend/src/index.css`. CSS variables at the root (`:root`) control the dark theme. No build step needed for Vite dev — changes reload instantly.

## Gotchas and pitfalls

1. **OpenAI API key missing:** If `OPENAI_API_KEY` is empty, the `/chat` endpoint returns an error. Set it in `.env`.

2. **Postgres not running:** The backend will hang or fail to start if Docker isn't running or `docker-compose up` hasn't been called. Always run `npm run db:up` first.

3. **Frontend dev server won't reach backend:** Vite proxy in `vite.config.ts` routes `/videos` and `/chat` to `http://localhost:3000`. Make sure the backend is running on that port.

4. **Range header not honored:** The `/videos/:id/stream` endpoint only honors `Range` if it's present. Without it, the full file is sent. This is fine for demos but slow for large files.

5. **`synchronize: true` can overwrite schema:** If you manually edit a table (via `psql`) and restart the server, TypeORM may revert your changes. Use migrations for schema control.

6. **Upload file stored but not listed:** If you restart the backend without Docker (Postgres stops), videos are listed from the DB but the files may be on disk. Clean state: stop containers, delete the Postgres volume, restart.

## Typescript

Both backend and frontend enforce strict mode:
- Backend: `nest build` compiles with TypeScript
- Frontend: `npm run build` runs `tsc -b && vite build`

Fix type errors before pushing. The CI/CD (if any) will catch them.

## Testing the backend alone (no frontend)

```bash
# Terminal 1: Start Postgres + backend
cd backend
npm run db:up
npm run start:dev

# Terminal 2: Test endpoints
curl http://localhost:3000/videos                                          # List (empty)

# Upload a test video
curl -F "title=Test" -F "file=@sample.mp4" http://localhost:3000/videos

# Get the video ID from the response, then stream it with range request
curl -I -H "Range: bytes=0-1023" http://localhost:3000/videos/<ID>/stream
# Should return 206 Partial Content

# Chat with the bot
curl -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How do I upload?"}]}' \
  http://localhost:3000/chat
# Should stream SSE response
```
