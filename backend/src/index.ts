import express from "express";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import membersRouter from "./routes/members";
import plansRouter from "./routes/plans";
import planDaysRouter from "./routes/planDays";
import groceryRouter from "./routes/grocery";
import realtimeRouter from "./realtime/router";

const app = express();
const port = Number(process.env.PORT) || 3001;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

app.use((request, response, next) => {
  response.header("Access-Control-Allow-Origin", frontendOrigin);
  response.header("Access-Control-Allow-Credentials", "true");
  response.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(membersRouter);
app.use(plansRouter);
app.use(planDaysRouter);
app.use(groceryRouter);
app.use(realtimeRouter);

const commitSha = process.env.COMMIT_SHA || process.env.GIT_SHA || "unknown";
const buildTime = process.env.BUILD_TIME || "unknown";

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
  console.log(`Build metadata: commit=${commitSha} buildTime=${buildTime}`);
});
