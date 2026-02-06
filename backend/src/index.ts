import express from "express";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import membersRouter from "./routes/members";
import planDaysRouter from "./routes/planDays";
import groceryRouter from "./routes/grocery";
import realtimeRouter from "./realtime/router";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);
app.use(membersRouter);
app.use(planDaysRouter);
app.use(groceryRouter);
app.use(realtimeRouter);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
