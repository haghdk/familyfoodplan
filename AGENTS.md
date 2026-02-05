# REPOSITORY GUIDELINES
This project is a family food planner used to create weekly food plans for a family. The food plan is created by selecting a day of the week to start the plan and the day of the week to end the plan, f.x. sunday to saturday. 

## Project overview

### Project architecture
- Backend:
    - NodeJs
    - TypeScript (`.tsx`/`.ts`)
    - Database: postgres
    - ORM: Prisma
- Frontend:
    - NextJS
    - TailwindCSS v4.1
    - TypeScript (`.tsx`/`.ts`)

### Project deployment
The project runs in docker with services for `database`, `backend` and `frontend` so each can be deployed separately

### Project structure
```
.
├── backend                   # All files related to the backend
├── frontend                  # All files related to NextJS frontend
```

## Working agreements
- Prefer `pnpm` when installing dependencies.
- When creating a new feature, always update README.md with a description of what it does.

### Coding conventions
- Always use TypeScript (`.tsx`/`.ts`) for new components and utilities.
- Use meaningful variable and function names

### Testing
No test framework currently configured. Run `npm run lint` before commits.

### Linting Rules
- `@typescript-eslint/no-explicit-any`: warn (avoid using `any` type)
- `@typescript-eslint/no-unused-vars`: warn (remove unused imports/variables)
- `@typescript-eslint/ban-ts-comment`: off (allows @ts-ignore comments)
- Follow Next.js core web vitals rules

### PR Instructions
- Title format: [<project_name>]-<Title>
- Always run `pnpm lint` and `pnpm test` before committing.