import { execSync } from "node:child_process";
import { Router } from "express";

const healthRouter = Router();

const appVersion = process.env.npm_package_version || "unknown";
const serverStartedAt = new Date().toISOString();

const resolveCommitSha = () => {
  if (process.env.COMMIT_SHA) {
    return process.env.COMMIT_SHA;
  }

  if (process.env.GIT_SHA) {
    return process.env.GIT_SHA;
  }

  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch (_error) {
    return "unknown";
  }
};

const commitSha = resolveCommitSha();
const buildTime = process.env.BUILD_TIME || serverStartedAt;

healthRouter.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

healthRouter.get("/health/details", (_request, response) => {
  response.status(200).json({
    status: "ok",
    version: appVersion,
    commitSha,
    buildTime
  });
});

export default healthRouter;
