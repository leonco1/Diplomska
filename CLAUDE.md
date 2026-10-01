# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**StreamApp** (`diplomska`) is a thesis project: a full-stack video streaming app with an AI support chatbot. A detailed companion guide lives in [AGENTS.md](./AGENTS.md) — consult it for endpoint-level conventions, gotchas, and curl test recipes.

## Commands

```bash
# Backend (NestJS, port 3000) — run from backend/
npm install
npm run db:up          # Start PostgreSQL (docker compose up -d)
npm run start:dev      # Dev server with watch
npm run build          # nest build → dist/
npm run start:prod     # node dist/main
npm run lint           # ESLint (eslint.config.mjs, flat config)
npm run format         # Prettier --write over src/
npm run db:down        # Stop PostgreSQL

# Frontend (React + Vite, port 5173) — run from frontend/
npm install
npm run dev            # Vite dev server (proxies /videos and /chat → :3000)
npm run build          # tsc -b && vite build
npm run lint           # ESLint (incl. react-hooks rules)
npm run format         # Prettier --write over src/
```

There is **no test suite** in either package — "build" plus `npm run lint` are the correctness gates. Both packages enforce TypeScript strict mode and ship ESLint (flat config) + Prettier; run lint and fix type errors before considering work done.

To run anything end-to-end: start Postgres, then the backend, then the frontend. The backend will fail to start if Postgres is unreachable.

## Architecture

Two independent npm packages, no shared workspace/root package.json:

- **backend/** — NestJS with feature modules wired into `app.module.ts`:
  - `videos/` — upload (Multer disk storage → `uploads/`), list, metadata, range streaming, delete. The streaming endpoint (`videos.controller.ts`) parses the `Range` header and returns `206 Partial Content` via `fs.createReadStream({start, end})` — this is what makes HTML5 player seeking work.
  - `chat/` — proxies OpenAI with `stream: true` and re-emits tokens as **Server-Sent Events** (`data: {"text":"..."}\n\n`, terminated by `data: {"done":true}\n\n`). The OpenAI key stays server-side; the bot is a fixed-system-prompt support assistant, not content-aware. Also exposes `POST /chat/emotion` — a non-streaming OpenAI JSON-mode call that classifies a message's dominant emotion (reuses the same client/model).
  - `emotion/` — facial emotion recognition. `POST /emotion/face` takes a base64 (data-URL) webcam frame and runs `@vladmandic/human` on the **`@tensorflow/tfjs-node` native backend**. The `Human` instance lives in `EmotionService` as a singleton; models are loaded lazily on first request from a remote `modelBasePath` (no model files vendored in the repo). Only the face detector + mesh + emotion models are enabled.
  - `auth/` — Keycloak-based auth. Tokens are **not** issued here; Keycloak issues them and this module *validates* them. `JwtStrategy` (passport-jwt + `jwks-rsa`) verifies the access token's signature against Keycloak's JWKS endpoint plus `issuer` (and `audience` only when `KEYCLOAK_AUDIENCE` is set — see the gotcha below), then JIT-provisions a local `User` (`UsersService.upsertFromToken`). `JwtAuthGuard` is registered **globally** (`APP_GUARD` in `app.module.ts`) so every route requires a valid token unless marked `@Public()` (only `GET /videos/:id/stream` is, since `<video src>` can't send a bearer header). `RolesGuard` + `@Roles('admin')` gate uploads/deletes against the token's `realm_access.roles`. `@CurrentUser()` injects the local user + roles.
  - `users/` — the local identity + per-user data. `User` mirrors a Keycloak identity (`keycloakId` = `sub`). Two one-to-many relations: `VideoView` (watch history, one row per (user, video), upserted on re-watch) and `EmotionSample` (facial-emotion readings captured *while watching a specific video*). `me`-scoped endpoints: `GET /me`, `GET /me/history`, `POST /me/history`, `POST /me/emotions`, `GET /me/videos/:videoId/emotions` (timeline + per-emotion aggregate).
  - Persistence is TypeORM with `synchronize: true` — tables auto-create from entities on startup, no migrations. Entities are registered in `app.module.ts` (`Video`, `User`, `VideoView`, `EmotionSample`).
- **frontend/** — React Router app. `api.ts` holds all fetch wrappers (an `authFetch` helper attaches the Keycloak bearer token + refreshes it; the chat path uses a manual line-by-line SSE reader). Auth is bootstrapped in `auth/AuthProvider.tsx` (wraps the app in `main.tsx`, `onLoad: 'login-required'`) over a shared `auth/keycloak.ts` instance; `useAuth()` exposes `authenticated`/`username`/`roles`/`login`/`logout`. Pages live in `pages/` (Upload route is admin-gated, `HistoryPage` shows watch history + emotion summaries), the floating chat panel in `components/ChatWidget.tsx`, the reusable webcam tracker in `components/EmotionTracker.tsx` (takes an optional `onSample` so the Watch page persists readings). In dev, `vite.config.ts` proxies `/videos`, `/chat`, `/emotion`, `/me` to the backend (same-origin requests); the browser talks to Keycloak on `:8081` directly.

### Cross-cutting facts worth knowing before editing

- **Auth is via Keycloak**, which runs as a `keycloak` service in `backend/docker-compose.yml` (`npm run db:up` starts it alongside Postgres) and auto-imports `backend/keycloak/realm-streamapp.json` on first start. Realm `streamapp`, public SPA client `streamapp-frontend`, realm roles `admin`/`user`, seed users `admin/admin` (admin) and `user/user`. Admin console: `http://localhost:8081` (`admin/admin`). The legacy `init-auth.sh` / `pg_hba.conf` / `init-with-auth.sql` files only configure Postgres client auth for Docker — unrelated to app-level auth.
- **State lives in two places that can drift:** video metadata in Postgres, the actual files in `backend/uploads/` (gitignored). Resetting the Postgres volume without clearing `uploads/` (or vice versa) leaves orphans.
- **`@tensorflow/tfjs-node` is a native addon** — it compiles bindings on `npm install` (and the first emotion request downloads model weights over HTTP). If install fails, that's the usual culprit. Face emotion is captured in the browser (`EmotionTracker.tsx`, opt-in webcam on the Watch page) and POSTed to the server for inference.
- **Config is env-driven** via `@nestjs/config` reading `backend/.env` (copy from `.env.example`). Key vars: `OPENAI_API_KEY` (chat fails without it), `OPENAI_MODEL`, `DB_*`, `PORT`, `FRONTEND_ORIGIN` (CORS), `MAX_UPLOAD_BYTES` (default 500 MB; uploads also filtered to `video/*`), and Keycloak: `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URI`, `KEYCLOAK_AUDIENCE`. The frontend reads `VITE_KEYCLOAK_URL`/`VITE_KEYCLOAK_REALM`/`VITE_KEYCLOAK_CLIENT_ID` from `frontend/.env` (copy from `frontend/.env.example`).
- **Keycloak token `aud` gotcha:** this realm's SPA access tokens carry **no `aud` claim** (only `azp: "streamapp-frontend"`), so **audience validation is off by default** — `KEYCLOAK_AUDIENCE` is empty in `.env`/`.env.example` and `JwtStrategy` skips the audience check when it's unset (signature + issuer are always validated). If you add an audience protocol mapper to the realm/client, decode a real token, then set `KEYCLOAK_AUDIENCE` to whatever `aud` it actually carries — leaving it set but mismatched (the old `account` default did this) makes every authenticated request 401, which surfaces in the SPA as "Failed to load videos" right after a seemingly-successful login.
