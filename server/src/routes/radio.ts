import { Router } from "express";
import dns from "node:dns";
import { lookup, lookupService } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

// Radio-Browser asks clients to discover mirrors via DNS instead of hardcoding one:
// resolve all.api.radio-browser.info, then reverse-lookup each IP for its hostname.
// Uses the OS resolver (getaddrinfo/getnameinfo); Node's c-ares resolver can pick a wrong DNS server on Windows.
async function getServers() {
  const addrs = await lookup("all.api.radio-browser.info", { all: true });
  const names = await Promise.allSettled(addrs.map((a) => lookupService(a.address, 443)));
  const hosts = names.flatMap((n) =>
    n.status === "fulfilled" && n.value.hostname.endsWith(".radio-browser.info") ? [n.value.hostname] : [],
  );
  if (!hosts.length) throw new Error("no radio-browser servers found");
  return [...new Set(hosts)].map((h) => `https://${h}`).sort();
}

let base: string | undefined;
async function radioBrowser(path: string) {
  if (!base) {
    const servers = await getServers();
    base = servers[Math.floor(Math.random() * servers.length)];
  }
  const res = await fetch(`${base}/json${path}`, { headers: { "User-Agent": "nirvana/0.1" } });
  if (!res.ok) throw new Error(`Radio-Browser ${res.status}`);
  return res.json();
}

// --- Stream proxy -------------------------------------------------------------
// Browsers only let the Web Audio equalizer read cross-origin audio that sends CORS headers,
// and many stations don't, so radio audio is relayed through this server.
// Station URLs are user-submitted to Radio-Browser, so never connect to private/internal addresses.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, prefix, "ipv6");
export const isBlocked = (ip: string) => blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");

// Checks the address the socket will actually connect to, so DNS rebinding can't slip past.
const safeLookup = ((host: string, opts: dns.LookupOptions, cb: (...a: unknown[]) => void) =>
  dns.lookup(host, { ...opts, all: true }, (err, addrs) => {
    if (err) return cb(err);
    const bad = addrs.find((a) => isBlocked(a.address));
    if (bad) return cb(new Error(`blocked address ${bad.address}`));
    opts.all ? cb(null, addrs) : cb(null, addrs[0].address, addrs[0].family);
  })) as unknown as typeof dns.lookup;

export function openStream(url: string, hops = 0): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return reject(new Error("unsupported protocol"));
    const literal = u.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && isBlocked(literal)) return reject(new Error("blocked address")); // IP literals skip lookup
    const get = u.protocol === "https:" ? https.get : http.get;
    const req = get(u, { lookup: safeLookup, headers: { "User-Agent": "nirvana/0.1" }, timeout: 10_000 }, (r) => {
      const status = r.statusCode ?? 0;
      if (status >= 300 && status < 400 && r.headers.location) {
        r.resume();
        if (hops >= 5) return reject(new Error("too many redirects"));
        return resolve(openStream(new URL(r.headers.location, u).href, hops + 1));
      }
      if (status !== 200) {
        r.resume();
        return reject(new Error(`station responded ${status}`));
      }
      resolve(r);
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("station timed out")));
  });
}

export const radio = Router();

// Takes a station id (not a URL) so clients can't point the proxy anywhere they like.
radio.get("/stream/:uuid", async (req, res, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.uuid)) return void res.status(400).json({ error: "invalid station id" });
  try {
    const [station] = (await radioBrowser(`/stations/byuuid/${req.params.uuid}`)) as { url_resolved: string }[];
    if (!station) return void res.status(404).json({ error: "station not found" });
    const upstream = await openStream(station.url_resolved);
    res.writeHead(200, {
      "Content-Type": upstream.headers["content-type"] ?? "audio/mpeg",
      "Cache-Control": "no-store",
    });
    upstream.pipe(res);
    res.on("close", () => upstream.destroy()); // listener left: stop pulling the station
  } catch (e) {
    next(e);
  }
});

radio.get("/servers", async (_req, res, next) => {
  try {
    res.json({ servers: await getServers(), current: base ?? null });
  } catch (e) {
    next(e);
  }
});

radio.get("/countries", async (_req, res, next) => {
  try {
    res.json(await radioBrowser("/countries?order=name&hidebroken=true"));
  } catch (e) {
    base = undefined;
    next(e);
  }
});

// ?country=IN (ISO 3166-1 alpha-2) narrows to that country; omitted = worldwide.
radio.get("/top", async (req, res, next) => {
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
  if (country && !/^[A-Z]{2}$/.test(country)) return void res.status(400).json({ error: "invalid country code" });
  try {
    res.json(
      await radioBrowser(
        country
          ? `/stations/search?countrycode=${country}&order=votes&reverse=true&hidebroken=true&limit=50`
          : "/stations/topvote/50",
      ),
    );
  } catch (e) {
    base = undefined; // pick a fresh server next time
    next(e);
  }
});
