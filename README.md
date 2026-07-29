# Family Food Planner

Family Food Planner is a weekly meal-planning app for families. Admins create plans by selecting a start day (for example, Sunday) and an end day (for example, Saturday), then manage meals and shopping across the week.

## Implemented Features

- **Admin login**: secure admin authentication with session-based access to protected pages.
- **Forgot password / password reset by email**: users can request a reset link from the sign-in screen. The backend emails a single-use link that expires after a configurable window (60 minutes by default), and the reset screen validates the link before showing the form. See [Password Reset Behavior Notes](#password-reset-behavior-notes).
- **User management + roles**: admins can create, edit, delete users, change admin email/password, and assign `ADMIN` or `VIEWER` role.
- **Read-only regular users**: viewer users can sign in and view plans, but cannot access any editing APIs or admin-only screens.
- **Initial admin bootstrap**: Docker setup now seeds a default admin user automatically on first startup.
- **Members management**: create, edit, list, and archive family members.
- **Weekly plans**: define week ranges and build day-by-day meal plans (dinner + repeatable breakfast/lunch rows).
- **Plan creation API**: admins can create a plan in one call using either explicit dates or weekday boundaries anchored to a specific date, with automatic `PlanDay` generation.
- **Plan browsing APIs + UI**: admins can list plans sorted by latest start date and open a plan detail view with nested day cards (dinner + breakfasts + lunches) for in-place calendar editing.
- **Homepage current-plan presentation component**: the home page now renders a reusable read-only `CurrentPlanTable` card with plan name/date range metadata plus responsive day/lunch/dinner layouts for desktop and small screens.
- **Responsive weekly overview matrix**: current-plan desktop view now renders a reusable read-only meal-by-day grid (N-day columns), while mobile keeps stacked day cards with meal sections and empty-state copy for unset lunch/dinner entries.
- **UI icon polish**: the homepage and plans overview now include Lucide icons on key headings, table labels, and action buttons to improve scanability and visual hierarchy.
- **Plan creation UI**: admins can create a new plan directly from the Plans screen by choosing a name and date range, then jump straight into editing.
- **Plan editing**: admins can update a plan's title and date range after creation, with safe regeneration of `PlanDay` rows to match the new boundaries.
- **Set current plan controls**: admins can mark any plan as the current plan from both the plans list and individual plan detail pages, with immediate UI refresh across homepage and plan views.
- **Reusable confirmation modal + plan deletion flow**: added a generic `ConfirmModal` component (accessible dialog semantics, Escape-to-close, and initial focus management) and wired plan deletion to run only after explicit modal confirmation, including warning copy that deleting a food plan also removes its grocery list.
- **Plan deletion API**: admins can delete a plan by id; relational cascading removes associated plan-day and grocery records.
- **Shared plan date utilities**: backend routes now reuse a common plan service for ISO day-key parsing, date range generation, transactional plan/day creation, and typed error mapping for stable HTTP responses.
- **Plan-scoped plan days**: day entries are now scoped to a `Plan`, and legacy rows are migrated into a default `Legacy Plan` during database migration/seed.
- **Plan-scoped day editing routes**: dinner, breakfast, and lunch write endpoints now require both `planId` and `dayKey` (`/api/plans/:planId/days/:dayKey/...`) so updates are validated against the selected plan before persisting.
- **Breakfast planning support**: each plan day now supports repeatable breakfast rows with optional member assignment, matching lunch behavior in APIs/UI and allowing breakfast-linked grocery ingredients.
- **Grocery sharing**: generate tokenized public grocery links so non-admin shoppers can check off items.
- **Drag-to-reorder grocery list**: items are still added as they come to mind (each new item lands at the bottom), and the merged shopping list can then be dragged into the order you walk the store — vegetables, bread, meat, cheeses, eggs, milk, hygiene. The manual order is stored per plan and used by the detailed item list and the shared shopper link as well. See [Grocery List Ordering](#grocery-list-ordering).
- **Realtime grocery updates**: grocery item check/uncheck and edits are synchronized live across admin and shared views.
- **UI redesign + design system**: the whole frontend was restyled around a warm, food-themed token set with automatic light/dark theming, a shared component library (`Button`, `Card`/`SectionCard`, `Field`, `Badge`, `Alert`, `EmptyState`, `PageHeader`, `ConfirmModal`), a sticky app header with active-route navigation, meal-coded colours (breakfast / lunch / dinner), "today" highlighting across plan views, and a redesigned shared shopping list with checkbox rows and a progress bar. See [Design System](#design-system) below.
- **App icon + home screen install**: the app ships a branded cooking-pot icon (favicon, Apple touch icon, and Android/Chrome manifest icons) plus a web app manifest, so saving the site to a phone home screen shows the app icon and name instead of a generic screenshot, and launches it standalone without browser chrome. See [App icon and home screen install](#app-icon-and-home-screen-install).

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

## Design System

The frontend styling is token-driven. Components never hardcode palette values, which keeps light and dark themes in sync automatically.

### Tokens (`frontend/app/globals.css`)

Semantic CSS custom properties are declared in Tailwind's `@theme` block and re-declared under `@media (prefers-color-scheme: dark)`:

- **Structure**: `canvas`, `canvas-tint`, `surface`, `surface-muted`, `border`, `border-strong`
- **Text**: `fg`, `fg-muted`, `fg-subtle`
- **Brand / accent**: `brand`, `brand-strong`, `brand-soft`, `brand-border`, `brand-fg`, `accent`, `accent-soft`, `accent-border`
- **Status**: `success`, `warning`, `danger` (each with `-soft` / `-border` variants)
- **Meals**: `breakfast`, `lunch`, `dinner` (each with a `-soft` background variant)
- **Elevation**: `shadow-card`, `shadow-lifted`

Use them through normal Tailwind utilities — `bg-surface`, `text-fg-muted`, `border-brand-border`, `shadow-card`.

### Shared components (`frontend/components/ui/`)

| Component | Purpose |
| --- | --- |
| `Button` | Variants `primary`, `secondary`, `ghost`, `soft`, `danger`, `dangerSolid`; sizes `sm`, `md`, `lg`, `icon`. `buttonClassName()` is exported so `next/link` anchors can share the same styling. |
| `Card` / `SectionCard` | Base surface card, plus a titled variant with icon, description and action slots. |
| `Field` | `TextField`, `SelectField`, `TextAreaField` with labels, hints and inline error text; `controlClassName` is exported for ad-hoc inputs. |
| `Badge` | Pill labels with `neutral`, `brand`, `accent`, `warning`, `danger` and per-meal tones. |
| `Alert` | Inline `info` / `success` / `warning` / `error` messaging with icons. |
| `EmptyState` | Consistent empty/zero-data presentation. |
| `PageHeader` | Page title with optional eyebrow, description and action slot. |
| `ConfirmModal` | Accessible confirmation dialog (Escape to close, initial focus, danger variant). |

### Shared helpers (`frontend/lib/`)

- `cn.ts` — small class-name joiner.
- `dates.ts` — day-key parsing plus `formatWeekday`, `formatShortDate`, `formatDayLabel`, `formatDateRange` and `getTodayDayKey` (used for the "Today" highlight across plan views).

### App icon and home screen install

The app icon is the same Lucide `cooking-pot` mark used in the site header, drawn in white on the brand green (`#2c7a5b` → `#226349`) background.

| File | Used for |
| --- | --- |
| `frontend/app/icon.svg` | Scalable favicon (`<link rel="icon">`, served at `/icon.svg`). |
| `frontend/app/favicon.ico` | Legacy 16/32/48 favicon for desktop browsers and bookmarks. |
| `frontend/app/apple-icon.png` | 180×180 Apple touch icon — the tile iOS/iPadOS shows for "Add to Home Screen". Full-bleed square because Safari applies its own rounding. |
| `frontend/public/icons/icon-192.png`, `icon-512.png` | Android/Chrome manifest icons (`purpose: any`). |
| `frontend/public/icons/icon-maskable-512.png` | Android maskable icon; the glyph stays inside the 80% safe zone so it survives circular/squircle cropping. |
| `frontend/app/manifest.ts` | Web app manifest served at `/manifest.webmanifest`: app name (`Family Food Planner`), home screen label (`Food Planner`), `display: standalone`, `start_url: /`, theme and background colours. |

`frontend/app/layout.tsx` links the manifest, sets the `theme-color` meta tag and enables `appleWebApp` metadata, so an installed app launches full screen without browser chrome. `frontend/middleware.ts` excludes the icon and manifest paths from the auth redirect, so phones can fetch them even without a session.

Regenerating the raster icons (only needed if the mark or brand colours change):

```bash
pip install cairosvg pillow
python3 frontend/scripts/generate-icons.py
```

## API Route Summary

> Base backend URL is typically `http://localhost:4000` in local development.

### Authentication
- `POST /api/auth/login` — authenticate user (`ADMIN` or `VIEWER`) and return role-aware session payload.
- `POST /api/auth/logout` — clear admin session.
- `GET /api/auth/me` — fetch current authenticated user and role.
- `POST /api/auth/forgot-password` — request a reset link for an email address. Always returns `200` with the same body whether or not the address has an account, and is rate limited to 5 requests per address/client every 15 minutes (`429` beyond that).
- `GET /api/auth/reset-password/:token` — report whether a reset link is still usable (`{ "valid": boolean }`), so the reset screen can show an "expired link" state instead of a dead form.
- `POST /api/auth/reset-password` — consume a reset token and set the new password. Returns `400` for an expired, reused, or unknown token, and for passwords shorter than 6 characters.

### Health / Build Diagnostics
- `GET /health` — basic liveness check.
- `GET /health/details` — liveness plus build metadata (`version`, `commitSha`, `buildTime`) to help verify deployed backend revision (falls back to `unknown` commit and server start time when env vars are not set).

### Members
- `GET /api/members` — list members (admin only).
- `POST /api/members` — create member (admin only).
- `PATCH /api/members/:id` — update member (admin only).
- `DELETE /api/members/:id` (or archive endpoint depending on implementation) — archive/remove member from active planning (admin only).

### Users
- `GET /api/users` — list users (admin only).
- `POST /api/users` — create user with role and password (admin only).
- `PUT /api/users/:id` — update email, password, and/or role (admin only).
- `DELETE /api/users/:id` — delete user, with safeguards to keep at least one admin (admin only).

### Weekly Plans / Meals
- Plan and meal endpoints under `/api/plans/...` handle week creation, day meal entries, breakfast/lunch rows, and dinner updates.
- `POST /api/plans` — create a plan and all plan-day rows for a validated date range (admin only).
- `GET /api/plans` — list plans ordered by newest `startDate` first (authenticated users).
- `GET /api/plans/:planId` — fetch one plan with nested `planDays`, `dinnerDish`, `breakfastDishes`, and `lunchDishes` (authenticated users).
- `PUT /api/plans/:planId` — update plan name and date range; the backend adds/removes `PlanDay` rows to keep data aligned with the new range (admin only).
- `DELETE /api/plans/:planId` — delete a plan by id; returns `404` when the plan does not exist and cascades removal of related plan-day and grocery data (admin only).

### Grocery Lists
- Admin grocery routes under `/api/plans/:id/grocery-list...` support create/update/delete and share-link management.
- `PUT /api/plans/:planId/grocery-items/order` — store the manual shopping order for a plan; the body is `{ "itemIds": [12, 7, 3, …] }`, listing the item ids in the order they should appear (admin only).
- Shared shopper routes under `/api/grocery/:token...` allow token-scoped reads and checkoff updates without admin login.
- SSE stream endpoint(s) provide realtime grocery state synchronization for both admin and shared-token clients.

## Grocery List Ordering

The store you shop in has its own layout, so the list is ordered by hand rather than alphabetically.

- Every `GroceryItem` carries a `sortOrder`, numbered across the whole plan so items belonging to different plan days share one sequence. All grocery reads (admin list, merged list, shared list) return items in that order.
- Adding an item is unchanged: it is appended after the current last item, which keeps "write it down as it comes to mind" working.
- On the plan's grocery page, each line of the **merged shopping list** has a grip handle. Dragging a line moves it, and because a merged line can cover the same ingredient from several meals, all of the items behind that line move with it.
- Dragging works with mouse, touch, and pen (it is built on pointer events, so there is no separate mobile path), and the handle also responds to <kbd>↑</kbd>/<kbd>↓</kbd> when focused, so the list can be reordered from a keyboard. Holding a row against the top or bottom of the screen scrolls a list that is longer than the viewport.
- The new order is saved with `PUT /api/plans/:planId/grocery-items/order` and broadcast as a `grocery_items_reordered` realtime event, so open shared shopper links re-sort immediately without a refresh.
- Item ids left out of a reorder request keep their relative order and stay at the end of the list, so an item added by someone else mid-drag is never dropped.

## Password Reset Behavior Notes

- The sign-in screen links to `/forgot-password`. Submitting an address always shows the same confirmation, so the form cannot be used to discover which emails have accounts.
- The emailed link points at `/reset-password?token=…`. That page is server-rendered and validates the token before rendering the form, so an expired or already-used link shows a "request a new link" state rather than a form that fails on submit.
- Tokens are 32 random bytes. Only their SHA-256 hash is stored, so a leaked database cannot be replayed as a working reset link.
- Each token is single-use and expires after `PASSWORD_RESET_TOKEN_TTL_MINUTES` (60 by default). Requesting a new link invalidates any earlier link for that account.
- `POST /api/auth/forgot-password` is rate limited in memory to 5 requests per address/client every 15 minutes. A multi-instance deployment would need a shared store for this to hold across processes.
- **Known limitation**: sessions are stateless JWTs, so a session issued before a reset stays valid until it expires. Resetting a password does not sign other devices out.

### Email configuration

Outgoing mail goes through SMTP (`nodemailer`), which works with any provider that offers SMTP credentials. Configure it with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`.

`APP_PUBLIC_URL` sets the origin used to build the link in the email. It must be the URL a browser can reach (in Docker Compose that is `http://localhost:3100`, not the internal `frontend` hostname); it falls back to `FRONTEND_ORIGIN`.

When `SMTP_HOST` is empty — the default for local development — no mail is sent and the full reset link is written to the backend console instead, so the flow stays testable without a mail provider.

## Grocery Sharing Behavior Notes

- Grocery sharing is based on a **tokenized link** generated by an admin for a plan day.
- `POST /api/plans/:id/share-link` now returns the existing token when one already exists, or creates one only if missing.
- The public URL pattern is `/grocery/[token]` in the frontend.
- Anyone with the token link can open that list and toggle checkboxes.
- Checkoff actions are applied server-side and broadcast in realtime so all open sessions (admin + shared shoppers) stay in sync.
- Token rotation is an explicit action via `POST /api/plans/:id/share-link/rotate`; rotating invalidates old links and limits continued access.

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
- Optional password reset values in `backend/.env` (see [Email configuration](#email-configuration)):
  - `APP_PUBLIC_URL`, `PASSWORD_RESET_TOKEN_TTL_MINUTES`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`

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

- Frontend: `http://localhost:3100`
- Backend: `http://localhost:4100`

## Option B: Run with Docker Compose

A root-level `docker-compose.yml` defines three services:
- `database` (Postgres) on `localhost:55432`
- `backend` on `localhost:4100`
- `frontend` on `localhost:3100`

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
