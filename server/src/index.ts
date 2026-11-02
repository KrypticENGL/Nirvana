import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { pool } from "./db.js";
import { music } from "./routes/music.js";
import { radio } from "./routes/radio.js";

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const db = await pool?.query("select 1").then(
    () => true,
    () => false,
  );
  res.json({ ok: true, db: db ?? false });
});

app.use("/api/music", music);
app.use("/api/radio", radio);

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  // Client mistakes (e.g. malformed JSON) keep their 4xx; everything else is ours or upstream's.
  const status = err?.status >= 400 && err?.status < 500 ? err.status : 502;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "request failed" : "bad request" });
};
app.use(onError);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`nirvana api on :${port}`));
