# Family Food Planner

Family Food Planner is a weekly meal-planning app for families. Admins create plans by selecting a start day (for example, Sunday) and an end day (for example, Saturday), then manage meals and shopping across the week.

## Implemented Features

- **Admin login**: secure admin authentication with session-based access to protected pages.
- **Initial admin bootstrap**: Docker setup now seeds a default admin user automatically on first startup.
- **Members management**: create, edit, list, and archive family members.
- **Weekly plans**: define week ranges and build day-by-day meal plans (dinner + repeatable lunch rows).
- **Plan creation API**: admins can create a plan in one call using either explicit dates or weekday boundaries anchored to a specific date, with automatic `PlanDay` generation.
- **Plan browsing APIs + UI**: admins can list plans sorted by latest start date and open a plan detail view with nested day cards (dinner + lunches) for in-place calendar editing.
- **Homepage current-plan presentation component**: the home page now renders a reusable read-only `CurrentPlanTable` card with plan name/date range metadata plus responsive day/lunch/dinner layouts for desktop and small screens.
- **UI icon polish**: the homepage and plans overview now include Lucide icons on key headings, table labels, and action buttons to improve scanability and visual hierarchy.
- **Plan creation UI**: admins can create a new plan directly from the Plans screen by choosing a name and date range, then jump straight into editing.
- **Plan editing**: admins can update a plan's title and date range after creation, with safe regeneration of `PlanDay` rows to match the new boundaries.
- **Shared plan date utilities**: backend routes now reuse a common plan service for ISO day-key parsing, date range generation, transactional plan/day creation, and typed error mapping for stable HTTP responses.
- **Plan-scoped plan days**: day entries are now scoped to a `Plan`, and legacy rows are migrated into a default `Legacy Plan` during database migration/seed.
- **Plan-scoped day editing routes**: dinner and lunch write endpoints now require both `planId` and `dayKey` (`/api/plans/:planId/days/:dayKey/...`) so updates are validated against the selected plan before persisting.
- **Grocery sharing**: generate tokenized public grocery links so non-admin shoppers can check off items.
- **Realtime grocery updates**: grocery item check/uncheck and edits are synchronized live across admin and shared views.

## Architecture Summary

### Repository Layout

```text
.
├── backend/   # Node.js + TypeScript API, auth, business logic, Prisma
└── frontend/  # Next.js + TypeScript UI, Tailwind styling, client routing
```

### `backend/`

- Runtime: **Node.js** with **TypeScript**
- API framework: Express-style HTTP routes (under `/api/...`)
- Database: **PostgreSQL**
- ORM/migrations: **Prisma** (`schema.prisma`, migrations, seed)
- Responsibilities:
  - Admin authentication (login/logout/me)
  - Member CRUD and archival
  - Weekly plan and meal management
  - Grocery list APIs (admin + shared token access)
  - Realtime grocery streaming (SSE)

### `frontend/`

- Framework: **Next.js** (App Router)
- Language: **TypeScript**
- Styling: **Tailwind CSS v4.1**
- Responsibilities:
  - Admin login page and protected routes
  - Member management UI
  - Weekly planning screens
  - Grocery list management UI
  - Shared grocery page for tokenized links
  - Realtime checkoff UX updates

## API Route Summary

> Base backend URL is typically `http://localhost:4000` in local development.

### Authentication
- `POST /api/auth/login` — authenticate admin user.
- `POST /api/auth/logout` — clear admin session.
- `GET /api/auth/me` — fetch current authenticated admin.

### Members
- `GET /api/members` — list members.
- `POST /api/members` — create member.
- `PATCH /api/members/:id` — update member.
- `DELETE /api/members/:id` (or archive endpoint depending on implementation) — archive/remove member from active planning.

### Weekly Plans / Meals
- Plan and meal endpoints under `/api/plans/...` handle week creation, day meal entries, lunch rows, and dinner updates.
- `POST /api/plans` — create a plan and all plan-day rows for a validated date range (admin-auth required).
- `GET /api/plans` — list plans ordered by newest `startDate` first for plan selection cards.
- `GET /api/plans/:planId` — fetch one plan with nested `planDays`, `dinnerDish`, and `lunchDishes` for calendar/day-card rendering.
- `PUT /api/plans/:planId` — update plan name and date range; the backend adds/removes `PlanDay` rows to keep data aligned with the new range.

### Grocery Lists
- Admin grocery routes under `/api/plans/:id/grocery-list...` support create/update/delete and share-link management.
- Shared shopper routes under `/api/grocery/:token...` allow token-scoped reads and checkoff updates without admin login.
- SSE stream endpoint(s) provide realtime grocery state synchronization for both admin and shared-token clients.

## Grocery Sharing Behavior Notes

- Grocery sharing is based on a **tokenized link** generated by an admin for a plan.
- The public URL pattern is `/grocery/[token]` in the frontend.
- Anyone with the token link can open that list and toggle checkboxes.
- Checkoff actions are applied server-side and broadcast in realtime so all open sessions (admin + shared shoppers) stay in sync.
- Rotating/regenerating a share token invalidates old links and limits continued access.

## Local Development

## Option A: Run locally with pnpm (without Docker)

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment files

- Copy backend env:

```bash
cp backend/.env.example backend/.env
```

- Set required backend values in `backend/.env`:
  - `DATABASE_URL`
  - `PORT`
  - `AUTH_JWT_SECRET`
  - `FRONTEND_ORIGIN` (allowed browser origin for CORS, default `http://localhost:3000`)
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`

> Ensure Postgres is running and reachable by `DATABASE_URL`.

### 3) Prepare database

```bash
pnpm --dir backend prisma:generate
pnpm --dir backend prisma:migrate
pnpm --dir backend prisma:seed
```

### 4) Start services in separate terminals

```bash
pnpm --dir backend dev
pnpm --dir frontend dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## Option B: Run with Docker Compose

A root-level `docker-compose.yml` defines three services:
- `database` (Postgres) on `localhost:5432`
- `backend` on `localhost:4000`
- `frontend` on `localhost:3000`

Start all services:

```bash
docker compose up --build
```

On backend startup, Prisma migrations are applied and the admin seed runs automatically. Configure credentials with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your shell or `.env` before running compose (defaults are provided for local development).

Stop services:

```bash
docker compose down
```

## Quality Checks

Run before committing:

```bash
pnpm lint
pnpm test
```

## Package Scripts

### Backend (`backend/package.json`)

- `pnpm --dir backend lint` — TypeScript type-check via `tsc --noEmit`.
- `pnpm --dir backend test` — placeholder test script.
- `pnpm --dir backend prisma:migrate` — run Prisma development migrations.
- `pnpm --dir backend prisma:generate` — regenerate Prisma client.
- `pnpm --dir backend prisma:seed` — seed initial admin user and ensure the default `Legacy Plan` exists.

### Frontend (`frontend/package.json`)

- `pnpm --dir frontend lint` — Next.js linting.
- `pnpm --dir frontend test` — placeholder test script.

## Tasks

- See [`TASKS.md`](./TASKS.md) for tracked implementation tasks, including dependency maintenance work.
