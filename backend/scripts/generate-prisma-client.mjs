import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Must match the generator output path in prisma/schema.prisma.
const generatedClientDirectory = resolve(backendRoot, "src/generated/prisma");

// `prisma generate` refuses to write into a directory that is not empty and
// does not look like a client it produced, and it exits non-zero when it
// refuses. In Docker this directory is a bind mount, so files from an older
// Prisma version — or from an interrupted generate — outlive the container and
// wedge the next start. Because generation runs from `postinstall`, that
// failure would take `npm install` down with it and leave the backend
// restarting in a loop, so the output is always cleared before regenerating.
try {
  rmSync(generatedClientDirectory, { recursive: true, force: true });
} catch (error) {
  // Most likely a bind mount whose files belong to another user. Say so
  // plainly, because the failure surfaces as a container that will not start.
  console.error(
    `Could not clear ${generatedClientDirectory}: ${error.message}\n` +
      "Remove that directory by hand, then install again."
  );
  process.exit(1);
}

execFileSync("prisma", ["generate"], {
  cwd: backendRoot,
  stdio: "inherit",
  // npm and pnpm put the local bin directory on PATH for their own scripts, but
  // not when this file is run directly with node, so add it either way.
  env: {
    ...process.env,
    PATH: [resolve(backendRoot, "node_modules/.bin"), process.env.PATH].filter(Boolean).join(delimiter)
  },
  // The prisma binary is a .cmd shim on Windows, which needs a shell to run.
  shell: process.platform === "win32"
});
