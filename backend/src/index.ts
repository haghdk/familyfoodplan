import express from "express";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(healthRouter);
app.use(authRouter);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
