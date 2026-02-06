import express from "express";
import healthRouter from "./routes/health";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.use(healthRouter);

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
