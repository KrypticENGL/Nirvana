import { Router } from "express";

// Audius: no API key, but clients must pick a discovery host first.
let host: string | undefined;
const getHost = async () => (host ??= ((await (await fetch("https://api.audius.co")).json()) as { data: string[] }).data[0]);

async function audius(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${await getHost()}/v1${path}${sep}app_name=nirvana`);
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  return res.json() as Promise<{ data: AudiusTrack[] }>;
}

type AudiusTrack = {
  id: string;
  title: string;
  duration: number;
  is_streamable?: boolean;
  user: { name: string };
  artwork?: Record<string, string> | null;
};

// Slim shape the web app uses; drops tracks Audius won't stream (gated/deleted).
const toTracks = ({ data }: { data: AudiusTrack[] }) =>
  data
    .filter((t) => t.is_streamable !== false)
    .map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.user.name,
      duration: t.duration,
      artwork: t.artwork?.["480x480"] ?? t.artwork?.["150x150"] ?? null,
    }));

export const music = Router();

music.get("/trending", async (_req, res, next) => {
  try {
    res.json(toTracks(await audius("/tracks/trending?limit=30")));
  } catch (e) {
    host = undefined; // pick a fresh host next time
    next(e);
  }
});

music.get("/search", async (req, res, next) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q || q.length > 100) return void res.status(400).json({ error: "q must be 1-100 characters" });
  try {
    res.json(toTracks(await audius(`/tracks/search?query=${encodeURIComponent(q)}&limit=30`)));
  } catch (e) {
    host = undefined;
    next(e);
  }
});

// The <audio> element follows this redirect to Audius's signed stream URL.
music.get("/stream/:id", async (req, res, next) => {
  if (!/^[A-Za-z0-9]+$/.test(req.params.id)) return void res.status(400).json({ error: "invalid track id" });
  try {
    res.redirect(`${await getHost()}/v1/tracks/${req.params.id}/stream?app_name=nirvana`);
  } catch (e) {
    next(e);
  }
});
