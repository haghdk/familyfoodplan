import { execSync } from "node:child_process";
import { Router } from "express";

const healthRouter = Router();

const appVersion = process.env.npm_package_version || "unknown";
const serverStartedAt = new Date().toISOString();

const commitSha = process.env.COMMIT_SHA || process.env.GIT_SHA || "unknown";
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
