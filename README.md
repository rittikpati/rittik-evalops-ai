# RittikEvalOpsAI

A production-oriented **LLM evaluation platform** — build datasets, run multi-model experiments, and grade outputs against judge-defined quality dimensions, all behind a single Next.js application backed by Supabase PostgreSQL and OpenRouter.

Built on Next.js 16 (App Router, Turbopack), React 19, TypeScript, and Drizzle ORM.

---

## Key Features

- **Datasets & test cases** — create datasets and enrich them via:
  - Manual test-case editing
  - Paste-in content
  - File upload with automatic extraction: `.docx`, `.pdf`, `.xlsx`
- **Experiments** — run one dataset against N models with a shared prompt template, `temperature`, and `maxTokens` budget.
- **Live evaluation progress** — streaming SSE progress (current model, test case, completed/total, pass/fail) while runs execute.
- **Judge-based scoring** — outputs are scored across dimensions such as accuracy, faithfulness, relevance, hallucination, safety, and more by a configurable judge model (default `openai/gpt-4o` via OpenRouter).
- **Automated aggregation** — runs are collapsed into canonical per-model and overall metrics: success rate, average accuracy, latency, token usage, and estimated cost.
- **Model registry** — curated OpenRouter catalog with optional user-defined custom models and per-user enable/disable toggles.
- **Dashboards & analytics** — workspace overview, experiment comparison, evaluation history, and analytics views backed by Recharts.
- **Prompt management** — save reusable system/user prompts for experiments.
- **Email/password authentication** — stateless, HMAC-SHA256-signed session cookies with route protection (login, register, session, profile).

---

## Tech Stack

| Layer       | Technology |
| ----------- | ---------- |
| Framework   | Next.js 16 (App Router), Turbopack |
| UI          | React 19, TypeScript, Tailwind CSS 4 |
| Styling     | Tailwind CSS, design tokens |
| Charts      | Recharts |
| Database    | Supabase PostgreSQL via Drizzle ORM + `postgres-js` |
| Migrations  | Drizzle Kit (SQL migrations in `drizzle/`) |
| Auth        | NextAuth v5 (Auth.js) + custom HMAC-SHA256 signed-cookie sessions |
| AI provider | OpenRouter (generation + judge) with a built-in mock fallback |
| Import      | `mammoth` (.docx), `pdf-parse` (.pdf), `xlsx` (.xlsx) |
| Motion      | `motion`, Lucide icons |

---

## Architecture

The codebase is cleanly separated into **backend** (server-only) and **frontend** (client/shared UI) concerns. Because Next.js requires page and route files inside `app/`, that folder contains only thin re-export shims that delegate to the real implementations.

```
.
├── app/                    # Next.js App Router entry points (re-export shims)
│   ├── layout.tsx          #   -> re-exports frontend/layout.tsx
│   ├── page.tsx            #   -> re-exports frontend/pages/*
│   └── api/**/route.ts     #   -> re-exports backend/api/*
├── backend/                # Server-only code
│   ├── api/                #   All route handlers (auth, datasets, experiments, ...)
│   └── lib/                #   DB client & schema, auth, AI layer, repositories
├── frontend/               # Client + shared UI code
│   ├── components/         #   Reusable UI components
│   ├── pages/              #   Page components (one per route)
│   ├── hooks/              #   Client hooks (e.g. live-run SSE)
│   ├── layouts/            #   Nested layouts
│   ├── lib/                #   Client utilities, theme, design tokens
│   ├── styles/             #   Global styles
│   ├── types/              #   Shared TypeScript types
│   └── data/               #   Static/mock data
├── proxy.ts                # Next.js proxy (middleware): auth-gated routes
├── drizzle/                # Database migrations
├── scripts/                # Seed + regression test scripts
└── public/                 # Static assets
```

> **Why the split?** Keeping backend logic (`backend/`) and frontend code (`frontend/`) in explicit top-level folders makes the server/client boundary obvious and keeps Next.js-specific boilerplate (`app/`) to the minimum the framework requires.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm (bundled with Node.js)
- A Supabase PostgreSQL database
- An OpenRouter API key (optional in development — the app falls back to a mock provider)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

All required variables are documented in [`.env.example`](.env.example).

### 3. Run database migrations

Apply the committed Drizzle migrations against your Supabase PostgreSQL database (reads `DATABASE_URL` from `.env.local`):

```bash
npx drizzle-kit migrate
```

Alternatively, push the schema directly (not recommended for production):

```bash
npx drizzle-kit push
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register an account, create a dataset, and launch your first experiment.

---

## Environment Variables

| Variable                    | Description                                                                     | Default / Required |
| --------------------------- | ------------------------------------------------------------------------------- | ------------------ |
| `DATABASE_URL`              | Server-side Postgres connection string (Supabase). **Never expose to the client.** | Required |
| `AUTH_SECRET`               | Secret for HMAC-SHA256-signed session cookies / Auth.js. 32+ random chars.        | Required (prod) |
| `AUTH_URL`                  | Public app origin (e.g. `https://rittikevalops.ai`).                              | Optional |
| `OPENROUTER_API_KEY`        | OpenRouter API key for generation and judge calls.                                | Optional* |
| `OPENROUTER_BASE_URL`       | OpenRouter API base URL.                                                          | Optional |
| `OPENROUTER_APP_URL`        | Referrer URL sent with OpenRouter requests.                                       | Optional |
| `OPENROUTER_APP_NAME`       | App name reported to OpenRouter.                                                  | Optional |
| `AI_PROVIDER`               | Force the provider: `mock` or `openrouter` (defaults to `mock` when key missing).  | Optional |
| `JUDGE_MODEL_ID`            | Default judge model id (e.g. `openai/gpt-4o`).                                    | Optional |
| `NEXT_PUBLIC_SUPABASE_URL`  | Public Supabase project URL (safe to ship to the browser).                        | Optional |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key (safe to ship to the browser).                       | Optional |

\* Without a key the app runs entirely in **mock** mode — ideal for local development and CI.

---

## Scripts

| Command                  | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `npm run dev`            | Start the Turbopack development server               |
| `npm run build`          | Create a production build                             |
| `npm run start`          | Serve the production build (after `build`)           |
| `npm run lint`           | Run ESLint over the project                           |

### Utility scripts (`scripts/`)

- `db-seed.ts` — seed the database with sample datasets and experiments.
- `regression-*.ts` — headless regression tests for aggregation, analytics, comparison, metrics, and success-rate logic.

---

## Database

Schema lives in `backend/lib/db/schema.ts`. Tables are managed through Drizzle Kit migrations stored in [`drizzle/`](drizzle/) (e.g. `0004_fluffy_wiccan.sql`), enabling grain-controlled, reviewable schema changes without exposing credentials.

---

## Deployment

The project is a standard Next.js 16 app and deploys to any Next.js-compatible platform (Vercel, Node.js host, Docker, etc.):

```bash
npm run build
npm run start
```

Set the environment variables from [`.env.example`](.env.example) on the host and ensure `DATABASE_URL` and `AUTH_SECRET` point at production values.