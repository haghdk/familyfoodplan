# Family Food Planner

Family Food Planner is a weekly meal planning app that helps families build a plan by selecting a start day (for example, Sunday) and an end day (for example, Saturday).

## App Architecture

### Backend
- Node.js with TypeScript
- Prisma ORM
- Postgres database
- Backend scaffold includes a Prisma schema setup and a basic Express server with a health endpoint.

### Frontend
- Next.js
- Tailwind CSS v4.1
- TypeScript
- Includes a landing page that introduces the planner and a placeholder `/login` route for future authentication.

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
