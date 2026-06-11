# StreamApp 🎬

A full-stack video streaming web app with an AI support chatbot. Built as a thesis (`diplomska`) project.

- **Frontend** — React + Vite (TypeScript)
- **Backend** — NestJS (TypeScript)
- **Database** — PostgreSQL via TypeORM (runs in Docker)
- **Storage** — uploaded videos saved to the local filesystem, streamed with HTTP range requests (seeking/scrubbing works)
- **AI** — OpenAI-powered support chatbot, streamed to the browser over Server-Sent Events

## Architecture

```
diplomska/
├── backend/      NestJS API  (port 3000)
│   ├── src/videos/   upload · list · range streaming
│   ├── src/chat/     OpenAI support bot (SSE)
│   ├── uploads/      stored video files (gitignored)
│   └── docker-compose.yml   PostgreSQL
└── frontend/     React app   (port 5173, proxies /videos and /chat → backend)
```

## Prerequisites

- Node.js 20+ and npm
- Docker (for PostgreSQL)
- An OpenAI API key (for the chatbot)

## Setup & run

### 1. Backend

**Setup PostgreSQL (choose one):**

**Option A: macOS with Homebrew (recommended, no Docker needed)**
```bash
brew install postgresql@14
brew services start postgresql@14
createdb streamapp
```

**Option B: Docker**
```bash
cd backend && npm run db:up
```

**Then start the backend:**
```bash
cd backend
cp .env.example .env          # Edit to set DB_USER if using Homebrew
# If using Homebrew: change DB_USER to your macOS username, leave DB_PASSWORD empty
# If using Docker: change DB_USER to postgres, DB_PASSWORD to postgres
echo "OPENAI_API_KEY=sk-..." >> .env   # Optional: add your OpenAI key
npm install
npm run start:dev             # http://localhost:3000
```

Tables are created automatically from the TypeORM entities (`synchronize: true`) on first run.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173.

## API

| Method | Route                 | Description                                  |
| ------ | --------------------- | -------------------------------------------- |
| GET    | `/videos`             | List all videos (metadata)                   |
| GET    | `/videos/:id`         | One video's metadata                         |
| POST   | `/videos`             | Upload (`multipart/form-data`: title, description, file) |
| GET    | `/videos/:id/stream`  | Stream the file (supports `Range`, returns `206`) |
| DELETE | `/videos/:id`         | Delete a video and its file                  |
| POST   | `/chat`               | Support bot — streams the reply as SSE       |

## Notes

- The chatbot is a **support assistant** for the app (how to upload, formats, troubleshooting). The OpenAI key stays server-side and is never exposed to the browser.
- Max upload size is 500 MB (configurable via `MAX_UPLOAD_BYTES`).
- `synchronize: true` is convenient for a demo; use TypeORM migrations for production.
