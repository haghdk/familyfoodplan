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
