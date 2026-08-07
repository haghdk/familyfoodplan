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
- **Dishes (saved recipes) + one-press shopping**: a **Dishes** section where a dish is written down once — lasagne, with its minced beef, sheets and tomatoes — and then picked from a list when planning a day, instead of being typed in again every week. Meals can still be typed in by hand exactly as before; the picker is a shortcut, not a replacement. A day whose meal was picked from a saved dish grows an **Add ingredients to grocery list** button that copies the whole recipe onto the plan's shopping list in one press. See [Dishes and Their Ingredients](#dishes-and-their-ingredients).
- **Swap meals between days**: weeks rarely go to plan, so any meal can be moved to another day of the week without retyping it. Drag a meal's **Swap** button onto the same meal of another day, or press it to pick the day from a list. Breakfast, lunch, and dinner each move on their own, so trading Monday's and Tuesday's dinners leaves both days' breakfasts and lunches exactly where they were, and the ingredients on the grocery list follow the meal. See [Swapping Meals Between Days](#swapping-meals-between-days).
- **Grocery sharing**: generate tokenized public grocery links so non-admin shoppers can check off items.
- **Drag-to-reorder grocery list**: items are still added as they come to mind (each new item lands at the bottom), and the merged shopping list can then be dragged into the order you walk the store — vegetables, bread, meat, cheeses, eggs, milk, hygiene. The manual order is stored per plan and used by the detailed item list and the shared shopper link as well. See [Grocery List Ordering](#grocery-list-ordering).
- **Picked up items sink to the bottom**: ticking an item on the shared shopping list slides it below everything still to buy, so what is left keeps shrinking towards the top of the screen. The move is display only — unticking an item slides it straight back to the place it came from — and every row that shifts glides there instead of the list snapping into a new shape. See [Grocery List Ordering](#grocery-list-ordering).
- **Realtime grocery updates**: grocery item check/uncheck and edits are synchronized live across admin and shared views, with automatic stream reconnection and a polling fallback so the list still syncs where server-sent events cannot get through. See [Realtime Updates (SSE)](#realtime-updates-sse).
- **Plan-wide shared grocery list**: the shared shopper link covers every day of the plan, so ingredients added for a specific breakfast, lunch, or dinner appear alongside the general items instead of only the items stored on the plan's first day. Each line also names the meal it was added for. See [Grocery Sharing Behavior Notes](#grocery-sharing-behavior-notes).
- **UI redesign + design system**: the whole frontend was restyled around a warm, food-themed token set with automatic light/dark theming, a shared component library (`Button`, `Card`/`SectionCard`, `Field`, `Badge`, `Alert`, `EmptyState`, `PageHeader`, `ConfirmModal`), a sticky app header with active-route navigation, meal-coded colours (breakfast / lunch / dinner), "today" highlighting across plan views, and a redesigned shared shopping list with checkbox rows and a progress bar. See [Design System](#design-system) below.
- **Daily dinner push notification**: every day at 10:00 the backend sends a push notification telling everyone what is planned for dinner that day, or that no dinner has been set yet. See [Daily Dinner Reminder](#daily-dinner-reminder).
- **Settings section**: a per-account `/settings` screen where a signed-in user picks their language, turns the daily dinner reminder on or off, sees how many of their devices are registered, and can fire a test notification. The screen is built to hold future preferences alongside language and notifications. See [Settings](#settings).
- **English and Danish (i18n)**: every screen, button, validation message, and error is translated, and the language is picked per account under Settings. All copy lives in JSON files (`frontend/locales/*.json` for the UI, `backend/src/i18n/locales/*.json` for API messages), and dates follow the chosen language too — `4. aug.` and `tirsdag` in Danish, `Aug 4` and `Tuesday` in English. The daily dinner reminder and the password reset email are written in the recipient's own language, not the sender's. See [Internationalisation (i18n)](#internationalisation-i18n).
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
  - Saved dishes and their ingredients, and copying them onto a plan's grocery list
  - Weekly plan and meal management
  - Grocery list APIs (admin + shared token access)
  - Realtime grocery streaming (SSE)
  - Per-user settings (language, notifications) and Web Push device registrations
  - The daily dinner reminder scheduler
  - Translated API messages, reminders and emails (`src/i18n/`)

### `frontend/`

- Framework: **Next.js** (App Router)
- Language: **TypeScript**
- Styling: **Tailwind CSS v4.1**
- Responsibilities:
  - Admin login page and protected routes
  - Member management UI
  - Dishes screen for saving dishes with their ingredients
  - Weekly planning screens
  - Grocery list management UI
  - Shared grocery page for tokenized links
  - Realtime checkoff UX updates
  - Settings screen and the push notification service worker
  - English/Danish translation of the whole UI (`lib/i18n/`, `locales/`)

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
| `ToggleSetting` | Labelled on/off row for the settings screen, built on a real checkbox with `role="switch"` so keyboard and screen reader behaviour come for free. |

### Shared helpers (`frontend/lib/`)

- `cn.ts` — small class-name joiner.
- `dates.ts` — day-key parsing (`toDayKey`), `getTodayDayKey` (used for the "Today" highlight across plan views), and `createDateFormatter(translator)`, which returns the language-aware `formatWeekday`, `formatShortDate`, `formatDayLabel`, `formatDateRange`, `formatCalendarDate` and `formatCompactDayLabel`.
- `i18n/` — the translation layer: `config.ts` (supported locales, cookie name, `Accept-Language` parsing), `translate.ts` (message lookup, `{placeholder}` interpolation, plural selection), `dictionaries.ts` (loads `frontend/locales/*.json`), `server.ts` (`getLocale` / `getTranslations` for server components), `client.tsx` (`I18nProvider`, `useTranslations`, `writeLocaleCookie`), and `requestHeaders.ts` (sends the language to the backend). See [Internationalisation (i18n)](#internationalisation-i18n).

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

### Settings / Push Notifications
- `GET /api/settings` — the signed-in user's settings, plus push metadata: whether the server has VAPID keys, the VAPID public key the browser needs to subscribe, how many devices the account has registered, and the reminder time zone (authenticated users).
- `PUT /api/settings` — update the caller's settings. Body: `{ "dinnerReminderEnabled"?: boolean, "language"?: "en" | "da" }`. Both fields are optional, so the language picker and the reminder toggle can each save on their own; sending neither returns `400` (authenticated users).
- `POST /api/push/subscriptions` — register the calling browser for push. Body is the browser's `PushSubscription` JSON (`{ endpoint, keys: { p256dh, auth } }`). Keyed on the endpoint, so re-posting the same subscription updates it instead of duplicating (authenticated users).
- `DELETE /api/push/subscriptions` — unregister one device. Body: `{ "endpoint": "…" }`. Only deletes endpoints belonging to the caller (authenticated users).
- `POST /api/push/test` — send today's real reminder to the caller's own devices, ignoring their on/off setting, so push can be verified end to end. Returns `503` when the server has no VAPID keys (authenticated users).

### Dishes
- `GET /api/dishes` — list every saved dish with its ingredients, ordered by dish name (authenticated users, since the plan screens read it to build the dish picker).
- `POST /api/dishes` — create a dish. Body: `{ "name": "Lasagne", "notes"?: string, "ingredients"?: [{ "name": "Minced beef", "quantity"?: number, "unit"?: string }] }`. Ingredient lines with a blank name are dropped rather than rejected, so the form's trailing empty row never blocks a save. Returns `409` when the name is taken (admin only).
- `PUT /api/dishes/:dishId` — update a dish. The ingredient list is sent whole and replaces the stored one; grocery items already copied onto a plan are their own rows and are left untouched. Returns `404` for an unknown dish and `409` for a taken name (admin only).
- `DELETE /api/dishes/:dishId` — delete a dish and its ingredients. Days already planned with it keep their meal, with the link cleared (admin only).

### Weekly Plans / Meals
- Plan and meal endpoints under `/api/plans/...` handle week creation, day meal entries, breakfast/lunch rows, and dinner updates.
- `POST /api/plans` — create a plan and all plan-day rows for a validated date range (admin only).
- `GET /api/plans` — list plans ordered by newest `startDate` first (authenticated users).
- `GET /api/plans/:planId` — fetch one plan with nested `planDays`, `dinnerDish`, `breakfastDishes`, and `lunchDishes` (authenticated users).
- `PUT /api/plans/:planId` — update plan name and date range; the backend adds/removes `PlanDay` rows to keep data aligned with the new range (admin only).
- `DELETE /api/plans/:planId` — delete a plan by id; returns `404` when the plan does not exist and cascades removal of related plan-day and grocery data (admin only).
- `POST /api/plans/:planId/meal-swaps` — trade one meal of the day between two days of the plan. The body is `{ "mealType": "breakfast" | "lunch" | "dinner", "sourceDayKey": "2026-08-03", "targetDayKey": "2026-08-04" }`, and the response returns both days in the same shape as `GET /api/plans/:planId` so the caller can redraw them without refetching the plan. Returns `400` for an unknown meal type, a malformed day key, or two identical days, and `404` when a day key is not part of the plan (admin only). See [Swapping Meals Between Days](#swapping-meals-between-days).

### Grocery Lists
- Admin grocery routes under `/api/plans/:id/grocery-list...` support create/update/delete and share-link management.
- `POST /api/plans/:planId/grocery-items/from-dish` — copy a saved dish's ingredients onto the plan's grocery list. The body names exactly one planned meal (`{ "dinnerDishId": 12 }`, `{ "breakfastDishId": … }` or `{ "lunchDishId": … }`); the dish is taken from the one that meal was picked from, and an explicit `dishId` overrides it. Answers `{ groceryItems, addedCount, skippedCount }`, `400` when the meal belongs to another plan or was never picked from a saved dish, and `404` for an unknown dish (admin only). See [Dishes and Their Ingredients](#dishes-and-their-ingredients).
- `PUT /api/plans/:planId/grocery-items/order` — store the manual shopping order for a plan; the body is `{ "itemIds": [12, 7, 3, …] }`, listing the item ids in the order they should appear (admin only).
- Shared shopper routes under `/api/grocery/:token...` allow token-scoped reads and checkoff updates without admin login.
- SSE stream endpoint(s) provide realtime grocery state synchronization for both admin and shared-token clients.

## Settings

`/settings` is the per-account preferences screen, reachable from the header for every signed-in user (viewers included, since it only ever changes the caller's own account). It is the general home for preferences.

It holds two sections:

- **Language** — English or Danish, applied to the whole app the moment it is picked. See [Internationalisation (i18n)](#internationalisation-i18n).
- **Notifications** — the **Daily dinner reminder** toggle, plus a **Send a test notification** button that delivers today's actual reminder to your own devices so you can see what the 10:00 message will look like.

The toggle does two things at once, because both are needed before a notification can arrive:

1. **This browser** is subscribed to push (permission prompt → service worker → `PushSubscription` sent to the backend).
2. **Your account** is marked as wanting the reminder (`UserSettings.dinnerReminderEnabled`).

Turning it off reverses both: the device is unregistered and the account-level flag goes to `false`, which silences every other device on the account too. The row underneath the toggle shows whether *this* device is registered and how many devices the account has in total, so a phone and a laptop are easy to tell apart.

## Internationalisation (i18n)

The app ships in **English (`en`)** and **Danish (`da`)**. The language is a per-account preference, chosen under **Settings → Language**.

### Where the copy lives

All translated text is in JSON files, one per language, with no strings hardcoded in components:

| File | Covers |
| --- | --- |
| `frontend/locales/en.json`, `da.json` | Every screen, button, label, placeholder, empty state, ARIA label and client-side validation message. |
| `backend/src/i18n/locales/en.json`, `da.json` | API messages the UI shows verbatim, the daily dinner reminder, and the password reset email. |

Messages are nested and looked up by dotted path (`t("plans.emptyTitle")`), with `{placeholder}` interpolation (`t("grocery.items.editAriaLabel", { name: item.name })`).

**English is the reference dictionary.** Both `Dictionary` types are `typeof en`, and the locale map is typed `Record<Locale, Dictionary>`, so a key missing from `da.json` fails the type check rather than showing a key name to a user. The message keys themselves are a literal union derived from `en.json`, so a mistyped key is also a compile error.

Counted messages are `{ "one": …, "other": … }` pairs read through `plural(key, count)`, which injects `count` for you:

```json
"days": { "one": "{count} day", "other": "{count} days" }
```

English and Danish share the same one/other split, so the count alone selects the form.

### How the language reaches each layer

- **The cookie** `ffp_locale` is what every server component reads while rendering (`getLocale()` in `frontend/lib/i18n/server.ts`). It is written by the settings picker and, on a device that has never seen this account before, seeded from the login response.
- **The account** (`UserSettings.language`) is the durable copy, so the choice follows the user to their other devices and is available to the scheduler and the mailer, which have no request to read.
- **A first visit with no cookie** falls back to the browser's `Accept-Language`, then to English.
- **Client components** get the active dictionary from `<I18nProvider>` in the root layout via `useTranslations()`. Only the language being rendered is serialised into the page, so a page never ships the messages of a language nobody is reading.
- **The backend** lives on its own origin, so the cookie never reaches it. The frontend sends the chosen language as an `Accept-Language` header on the API calls whose response messages it displays (`localeHeader(locale)`), and `requestLocale(request)` resolves it server-side.

`<html lang>` is set from the active locale, and `generateMetadata` translates the document title and description.

### Dates

Nothing formats a date on its own. `createDateFormatter(translator)` in `frontend/lib/dates.ts` binds `Intl.DateTimeFormat` to the active language, so the same day renders as `Tuesday, Aug 4` in English and `tirsdag 4. aug.` in Danish. The words around a range ("From …", "Dates not set") are translated messages, not string literals.

### Adding a language

1. Add the code to `locales` in `frontend/lib/i18n/config.ts` and `backend/src/i18n/index.ts`, along with its `Intl` tag in `localeTags` and its own name in `localeNames`.
2. Copy `en.json` to `<code>.json` in both `frontend/locales/` and `backend/src/i18n/locales/` and translate the values. The type checker lists anything you missed.
3. Add the language to `weekdayFormatters` in `backend/src/services/dinnerReminder.ts` so the reminder can name weekdays in it.

The picker, the `Accept-Language` negotiation, and the per-language reminder dispatch all read the `locales` list, so nothing else needs touching.

### Known boundary

The `members`, `planDays`, and `grocery` routes still answer with English validation detail (`"Invalid day key. Expected YYYY-MM-DD."`, `"Selected member does not exist."`). Nothing surfaces those strings — every UI path through them shows its own translated copy instead — so they are left as developer-facing detail. The routes whose messages the UI *does* display verbatim (`auth`, `users`, `plans`, `settings`) are fully translated.

## Daily Dinner Reminder

Every day at 10:00 the backend sends one push notification to every registered device whose owner has the reminder switched on.

- **With a dinner planned** the notification reads *"Today's dinner"* / the dish name, with the dinner's notes on a second line when there are any.
- **With nothing planned** it reads *"No dinner planned for today"* / *"Nothing is set for dinner this Friday. Tap to plan something."*
- Tapping the notification opens the plan the day belongs to (`/plan/:id`), or the homepage when no plan covers today.
- **Each recipient reads it in their own language.** The text is built once per supported language and sent to the subscribers who chose it, so a household with a Danish and an English reader gets *"Dagens aftensmad"* on one phone and *"Today's dinner"* on the other. The weekday name in the "nothing planned" line is formatted in the same language. An account whose stored language is not one we ship is treated as English rather than skipped.

### Which dinner it picks

Plans are allowed to overlap, so the day is resolved in this order: the plan an admin marked as **current** wins first (the same plan the homepage shows), then a day that actually has a dinner beats an empty one, and the newest plan breaks any remaining tie.

### Scheduling behaviour

- The scheduler ticks once a minute rather than sleeping until the next 10:00, so clock changes, daylight saving transitions, and long process suspensions cannot make it drift or oversleep.
- "Today" and "10:00" are measured in `DINNER_REMINDER_TIMEZONE`, not the container clock, which in Docker is normally UTC. An unknown zone falls back to UTC with a warning.
- Each day is **claimed** in the `DinnerReminderLog` table before anything is sent. The unique `dayKey` is what makes the claim atomic, so a restart mid-send — or a second backend instance sharing the database — cannot notify the family twice.
- A backend that was down at 10:00 still sends when it comes back, but only within a **two hour catch-up window**. Later than that the day is skipped rather than buzzing phones at bedtime.
- Endpoints the push service rejects as gone (HTTP `404`/`410` — browser uninstalled, subscription revoked) are deleted automatically, so the device list does not silently rot.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` | *(empty)* | Public half of the VAPID key pair. Also served to the browser so it can subscribe. |
| `VAPID_PRIVATE_KEY` | *(empty)* | Private half. Signs outgoing push messages. |
| `VAPID_SUBJECT` | `mailto:no-reply@familyfoodplan.local` | Contact address push services can use to reach the operator. |
| `DINNER_REMINDER_ENABLED` | `true` | Set to `false` to stop the scheduler entirely. |
| `DINNER_REMINDER_HOUR` | `10` | Hour of day (0–23) to send at. |
| `DINNER_REMINDER_MINUTE` | `0` | Minute of the hour to send at. |
| `DINNER_REMINDER_TIMEZONE` | `Europe/Copenhagen` | Zone that "today" and the send time are measured in. |

Generate the key pair once and keep it stable — regenerating it invalidates every existing subscription, and each browser has to be toggled off and on again:

```bash
pnpm --dir backend push:vapid-keys
```

When the keys are missing — the default for local development — nothing is sent and the notification is logged to the backend console instead, mirroring how the mailer behaves without SMTP credentials. The settings screen says so plainly rather than offering a toggle that could not work.

### Browser requirements

- Push needs a **secure context**, so it works on `https://` and on `http://localhost`, but not over plain HTTP on a LAN address.
- The service worker is `frontend/public/sw.js`, served at `/sw.js`. It handles the `push` and `notificationclick` events only — it deliberately does not cache or intercept requests. `frontend/middleware.ts` excludes `/sw.js` from the auth redirect, because a browser refuses to register a worker whose URL answers with anything but the script itself.
- **On iPhone and iPad, notifications only work once the app has been added to the home screen** and opened from there. The settings screen detects this case and says so instead of failing at the permission prompt.
- A subscription lives in the browser, so it can outlive the server-side record (a database reset, or the browser being handed to another account). The settings screen re-registers any existing subscription on load, so a toggle that reads "on" is never quietly dead.

## Dishes and Their Ingredients

The same dozen dishes come round week after week, and each one takes the same shopping every time. **Dishes** (`/dishes`, admins only) is where that is written down once.

- A dish is a name, optional notes, and a list of ingredients — each with a quantity and a unit, the same shape a grocery item has, because copying them onto a shopping list is what they exist for. Dish names are unique, so "Lasagne" means one thing across every plan.
- The dish form always keeps one blank ingredient row at the bottom, and blank rows are dropped on save. Adding the next ingredient never starts with a press of **Add ingredient**.
- Editing a dish **replaces** its ingredient list. Grocery items already copied onto a plan are their own rows by then, so fixing a recipe never rewrites a shopping list somebody is mid-way through.
- Deleting a dish removes it and its ingredients. Days already planned with it keep their meal — the meal's link to the dish is cleared, not the meal itself — and grocery items already added stay on their lists.

### Planning from a saved dish

Every meal on a plan's day card — breakfast, lunch and dinner alike — has a **Choose a saved dish** picker above the name field, listing the saved dishes. Picking one fills the name in and remembers which dish it was.

- **Typing a meal in by hand still works exactly as before.** The picker's first option is *Type it in yourself*, and editing the name field after picking a dish drops the link, because the meal is no longer that dish. Nothing about the old flow was taken away.
- The link is stored on the planned meal (`DinnerDish.dishId`, `BreakfastDish.dishId`, `LunchDish.dishId`) rather than on the dish, so a dish can be planned on as many days as it is eaten on.
- Swapping meals between days carries the link with the meal, so a dinner traded to another day still knows the dish it came from.

### Adding a dish's ingredients to the grocery list

A meal that was picked from a saved dish which has ingredients shows an **Add ingredients to grocery list** button next to its Save and Delete buttons, once the meal itself has been saved. Pressing it copies every ingredient onto the plan's grocery list as `INGREDIENT` items attached to that meal, so each line names the meal it is for, exactly like an ingredient added by hand on the grocery page.

- **Pressing it twice does not duplicate the list.** Ingredients the meal already carries under the same name and unit are skipped, so pressing it again after adding one more ingredient to the dish tops the list up rather than doubling it. The page says how many were added and notes when some were already there.
- Copies land at the end of the manual shopping order, the same place a hand-added item lands, and are broadcast over the realtime stream so open shared shopper links pick them up without a refresh.
- The same dish planned on two days copies onto **both** days: each copy is attached to its own meal and stored on its own day, and the merged shopping list adds the two quantities into one line, which is what a week that eats lasagne twice actually needs to buy.
- The copies are ordinary grocery items once made. Editing or removing one on the grocery page changes only the list, never the dish.

## Swapping Meals Between Days

Something always comes up mid-week — a late meeting, a sports practice, a delivery that turns up a day early — and the fix is usually to trade two days around rather than to plan them again.

- Every meal section on a plan's day card carries a **Swap** button. Dragging it onto the same meal of another day trades the two, and dropping it on a day that has nothing planned for that meal moves the meal across instead.
- Pressing the button without dragging opens the plan's other days as a list, each showing what it currently holds for that meal ("Yoghurt and berries", or "Nothing planned"). That is the faster path on a phone, and the only path from a keyboard, since the button is reachable by <kbd>Tab</kbd> and opens the list on <kbd>Enter</kbd>.
- Dragging works with mouse, touch, and pen — it is built on pointer events, so there is no separate mobile path. While a meal is held, only the same meal on other days is outlined as a place it can go, the meal being moved dims, and the day under the pointer highlights. Holding the meal against the top or bottom of the screen scrolls the page, because two days of a week are rarely both on screen. <kbd>Esc</kbd> abandons the drag.
- **The three meals move independently.** Swapping dinners changes nothing about either day's breakfasts or lunches, which is what "swap Monday and Tuesday" usually means in practice: the dinner is the part that has to move, and the school lunches stay with the school day.
- **Ingredients travel with the meal.** A grocery item added for a specific dish is re-pointed to the day the dish landed on, so the plan's shopping data keeps matching the plan. General grocery items — the ones not added for any particular dish — stay on the day they were written down on. The merged shopping list covers the whole plan either way, so nothing appears or disappears from the shopper's list because of a swap.
- Breakfast and lunch are repeatable rows, so both days hand their whole set to the other day, member assignments and notes included.
- A day holds at most one dinner, and PostgreSQL enforces that per row rather than at the end of a transaction, so the two dinner rows cannot simply trade day ids. What the dishes are made of is traded instead, and the ingredients are re-pointed to follow the dish they were added for. The result is identical from the outside; only the row ids stay put.

## Grocery List Ordering

The store you shop in has its own layout, so the list is ordered by hand rather than alphabetically.

- Every `GroceryItem` carries a `sortOrder`, numbered across the whole plan so items belonging to different plan days share one sequence. All grocery reads (admin list, merged list, shared list) return items in that order.
- Adding an item is unchanged: it is appended after the current last item, which keeps "write it down as it comes to mind" working.
- On the plan's grocery page, each line of the **merged shopping list** has a grip handle. Dragging a line moves it, and because a merged line can cover the same ingredient from several meals, all of the items behind that line move with it.
- Dragging works with mouse, touch, and pen (it is built on pointer events, so there is no separate mobile path), and the handle also responds to <kbd>↑</kbd>/<kbd>↓</kbd> when focused, so the list can be reordered from a keyboard. Holding a row against the top or bottom of the screen scrolls a list that is longer than the viewport.
- The new order is saved with `PUT /api/plans/:planId/grocery-items/order` and broadcast as a `grocery_items_reordered` realtime event, so open shared shopper links re-sort immediately without a refresh.
- Item ids left out of a reorder request keep their relative order and stay at the end of the list, so an item added by someone else mid-drag is never dropped.

### Picked up items move to the bottom

- Ticking an item off moves it below every item that is still to buy, on the shared shopper link and in the detailed list on the plan's grocery page. Inside each group — still to buy, and already picked up — the manual shopping order is kept, so the next item to find is always the top row.
- **Nothing is written when a row sinks.** The stored `sortOrder` is untouched and the item keeps its place in the list the app holds in memory; only the rendering is regrouped. Unticking an item that was ticked by mistake therefore puts it back exactly where it was, with no need for the shopper to remember where that was.
- The tick is applied to the row immediately, before the server answers, and rolled back with an error message if the request fails. On a shop's connection, waiting for the response first would leave the row sitting still and then jump on its own a second later.
- **Rows that move are animated** by `useReorderAnimation` (`frontend/lib/useReorderAnimation.ts`), a small FLIP helper: after a re-render it measures how far each row moved, offsets it back to where it came from, and releases it, so it slides to its new slot in ~260ms. Passing a reordered array is all a list has to do. Rows are measured against their container, so page scrolling never registers as movement, and `prefers-reduced-motion: reduce` skips the animation entirely.
- The slide is a CSS transition on an inline transform rather than a Web Animations API animation. Reordering a keyed list makes React move the row's DOM node, and browsers cancel an element's animations when it leaves the document — even for a move that puts it straight back — which silently killed the animation on the one row that matters most: the row that was just ticked.

## Password Reset Behavior Notes

- The sign-in screen links to `/forgot-password`. Submitting an address always shows the same confirmation, so the form cannot be used to discover which emails have accounts.
- The emailed link points at `/reset-password?token=…`. That page is server-rendered and validates the token before rendering the form, so an expired or already-used link shows a "request a new link" state rather than a form that fails on submit.
- Tokens are 32 random bytes. Only their SHA-256 hash is stored, so a leaked database cannot be replayed as a working reset link.
- Each token is single-use and expires after `PASSWORD_RESET_TOKEN_TTL_MINUTES` (60 by default). Requesting a new link invalidates any earlier link for that account.
- The email is written in the **account owner's** language, not the language of whoever filled in the form, since the mail belongs to whoever holds the address.
- `POST /api/auth/forgot-password` is rate limited in memory to 5 requests per address/client every 15 minutes. A multi-instance deployment would need a shared store for this to hold across processes.
- **Known limitation**: sessions are stateless JWTs, so a session issued before a reset stays valid until it expires. Resetting a password does not sign other devices out.

### Email configuration

Outgoing mail goes through SMTP (`nodemailer`), which works with any provider that offers SMTP credentials. Configure it with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`.

`APP_PUBLIC_URL` sets the origin used to build the link in the email. It must be the URL a browser can reach (in Docker Compose that is `http://localhost:3100`, not the internal `frontend` hostname); it falls back to `FRONTEND_ORIGIN`.

When `SMTP_HOST` is empty — the default for local development — no mail is sent and the full reset link is written to the backend console instead, so the flow stays testable without a mail provider.

## Grocery Sharing Behavior Notes

- Grocery sharing is based on a **tokenized link** generated by an admin for a plan day.
- The token is stored on the plan's first day, but the shared list is **plan-wide**: it returns every grocery item belonging to the plan, on any day. Ingredients are stored on the day of the meal they were added for, so scoping the shared list to the token's own day used to hide every ingredient attached to a breakfast, lunch, or dinner that was not on the plan's first day, leaving only the general items visible.
- `POST /api/plans/:id/share-link` now returns the existing token when one already exists, or creates one only if missing.
- The public URL pattern is `/grocery/[token]` in the frontend.
- The plan's grocery page has an **Open** button beside **Copy** that opens the shared list in a new tab, so an admin can check what the shoppers see without leaving the page they are editing. It is disabled until a share link exists.
- Anyone with the token link can open that list and toggle checkboxes, including ingredients from any day of the plan. Each row shows the meal it came from (`Dinner · Lasagne`) or `General`, and the header shows the plan's date range.
- Checkoff actions are applied server-side and broadcast in realtime so all open sessions (admin + shared shoppers) stay in sync.
- Token rotation is an explicit action via `POST /api/plans/:id/share-link/rotate`; rotating invalidates old links and limits continued access.

## Realtime Updates (SSE)

Both the admin grocery page and the shared shopper link stream changes over server-sent events (`/api/realtime/grocery/...`). The badge in the page header shows `Live` while the stream is connected and `Reconnecting` while it is not.

- **The stream must not be buffered in transit.** Reverse proxies in the nginx family buffer proxied responses by default, which holds the stream back and leaves the page stuck on `Reconnecting` even though the backend is healthy and the list itself loads fine. The backend sends `X-Accel-Buffering: no` so nginx opts out; a proxy that ignores that header needs streaming enabled for the backend host (for nginx: `proxy_buffering off` and `proxy_read_timeout` comfortably above the 15 second keepalive).
- **A keepalive comment is sent every 15 seconds**, so idle proxy timeouts (commonly 30-60 seconds) do not drop the stream.
- **Reconnects are automatic.** A browser retries a stream that merely dropped, but not one that was closed by an error status or refused by a proxy, so the pages open a new stream themselves with exponential backoff (1s up to 30s). Every successful reconnect refetches the whole list, since anything that changed while the stream was down was never delivered.
- **Live updates are the fast path, not the only path.** While a page has no stream it refetches every 15 seconds, so two people shopping from the same link still converge even where server-sent events cannot get through at all. Checkoffs are always written to the server, independent of the stream.

## Prisma Client generation

- The Prisma Client is generated into `backend/src/generated/prisma`. It is **generated output, not source**, and is gitignored.
- Generation runs through `backend/scripts/generate-prisma-client.mjs`, which clears the output directory before regenerating. `prisma generate` refuses to write into a directory that is not empty and does not look like a client it produced, and in Docker that directory is a bind mount, so files from an older Prisma version or an interrupted generate survive between containers and would otherwise fail the install the startup command depends on.
- Generation runs automatically from the backend's `postinstall` script, so every environment gets a client built for the Prisma version it actually installed — whether it installs with `pnpm` (as local development does) or with `npm` (as the Docker `backend` service does). A committed client cannot satisfy both, and the mismatch is not a type error but a hard crash on the first query (`TypeError: Cannot read properties of undefined (reading 'graph')`), because the generated code and the client runtime share an internal format that changes between versions.
- `backend/prisma.config.ts` reads `DATABASE_URL` lazily so `postinstall` succeeds on a fresh checkout that has no `.env` yet. Commands that really need a database (`prisma migrate`, `prisma db seed`) still fail with a clear `Connection url is empty` error when it is unset.
- After changing `backend/prisma/schema.prisma`, run `pnpm --dir backend prisma:generate` to refresh the client.

## Local Development

## Option A: Run locally with pnpm (without Docker)

### 1) Install dependencies

```bash
pnpm install
```

The backend's `postinstall` script runs `prisma generate`, so the Prisma Client in `backend/src/generated/prisma` is always built for the Prisma version that was just installed. That directory is generated output and is not committed — see [Prisma Client generation](#prisma-client-generation).

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
- Optional push notification values in `backend/.env` (see [Daily Dinner Reminder](#daily-dinner-reminder)):
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
  - `DINNER_REMINDER_ENABLED`, `DINNER_REMINDER_HOUR`, `DINNER_REMINDER_MINUTE`, `DINNER_REMINDER_TIMEZONE`

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
- `pnpm --dir backend push:vapid-keys` — generate a VAPID key pair for push notifications (see [Daily Dinner Reminder](#daily-dinner-reminder)).

### Frontend (`frontend/package.json`)

- `pnpm --dir frontend lint` — Next.js linting.
- `pnpm --dir frontend test` — placeholder test script.

## Tasks

- See [`TASKS.md`](./TASKS.md) for tracked implementation tasks, including dependency maintenance work.
