import { defineConfig } from "prisma/config";

// The datasource url is only needed by the commands that talk to the database
// (migrate, db seed). Reading it lazily keeps `prisma generate` working on a
// fresh checkout that has no DATABASE_URL yet, which is what `postinstall`
// needs so the generated client always matches the installed client version.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: process.env.DATABASE_URL ?? ""
  }
});
