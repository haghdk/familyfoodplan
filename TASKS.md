# Project Tasks

## Dependency Update: Upgrade Prisma to latest

- **Goal**: Update backend Prisma dependencies to the newest stable release so runtime client and CLI are aligned.
- **Scope**: `backend/package.json`, lockfile updates, generated Prisma client.

### Implementation checklist

- [ ] Update `@prisma/client` to `latest` in `backend/package.json`.
- [ ] Update `prisma` to `latest` in `backend/package.json`.
- [ ] Install updated dependencies with `pnpm`.
- [ ] Regenerate Prisma client (`pnpm --dir backend prisma:generate`).
- [ ] Verify migrations can be applied in current environment.
- [ ] Run quality checks:
  - [ ] `pnpm --dir backend lint`
  - [ ] `pnpm --dir backend test`
  - [ ] `pnpm --dir frontend lint`
  - [ ] `pnpm --dir frontend test`

### Acceptance criteria

- Backend starts successfully with the updated Prisma client.
- No new lint/type errors in backend or frontend.
- Prisma CLI and generated client versions match.
