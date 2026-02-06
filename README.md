# Family Food Planner

Family Food Planner is a weekly meal planning app that helps families build a plan by selecting a start day (for example, Sunday) and an end day (for example, Saturday).

## App Architecture

### Backend
- Node.js with TypeScript
- Prisma ORM
- Postgres database
- Backend scaffold includes a Prisma schema setup, admin authentication endpoints (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`), and middleware for admin-only route protection.

### Frontend
- Next.js
- Tailwind CSS v4.1
- TypeScript
- Includes a landing page, an admin `/login` form, route-guard middleware for authenticated pages, and a navigation logout action.
- Adds a protected `/members` management screen for creating, editing, listing, and archiving family members with optimistic UI updates.
- Adds plan-day meal APIs and UI building blocks for one dinner per day plus repeatable lunch rows with optional member assignment.
- Adds grocery list APIs and a dedicated `/plan/[id]/grocery-list` screen to create general items, attach ingredient items to meals, and view merged quantities for shopping.
- Adds grocery list sharing with secure public tokens: admins can rotate share links from `/plan/[id]/grocery-list`, shoppers can open `/grocery/[token]`, and check/uncheck items without admin login.
- Adds realtime grocery synchronization over Server-Sent Events (SSE) for admin and shared-token grocery pages, including reconnect rehydration so all clients stay in sync after create/update/delete actions.

### Deployment
The project is dockerized with separate services for:
- `database`
- `backend`
- `frontend`

## Getting Started

```bash
pnpm install
pnpm lint
pnpm test
```

## Package Scripts

### Backend (`backend/package.json`)
- `pnpm --dir backend lint` runs a TypeScript type-check using `tsc --noEmit`.
- `pnpm --dir backend test` is a placeholder script and currently prints a message.

### Frontend (`frontend/package.json`)
- `pnpm --dir frontend lint` runs Next.js linting via `next lint`.
- `pnpm --dir frontend test` is a placeholder script and currently prints a message.

## Local Docker Development

A root-level `docker-compose.yml` is available for local development with three services:
- `database` (Postgres) on `localhost:5432`
- `backend` on `localhost:4000`
- `frontend` on `localhost:3000`

Start all services with:

```bash
docker compose up --build
```
