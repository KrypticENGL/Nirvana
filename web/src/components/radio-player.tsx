"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { attachEq, pauseOtherAudio } from "@/lib/audio";
import { Check, ChevronLeft, ExternalLink, Globe, Search, X } from "lucide-react";
import { Meter, PlayGlyph, Visualizer } from "@/components/visualizer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// Radio-Browser station fields this page reads (the API returns many more).
type Station = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  codec: string;
  bitrate: number;
  country?: string;
  countrycode?: string;
  state?: string;
  language?: string;
  tags?: string;
  votes?: number;
  homepage?: string;
};
type Country = { name: string; iso_3166_1: string; stationcount: number };

const pad = (n: number) => String(n).padStart(2, "0");
const format = (s: Station) => [s.codec, s.bitrate ? `${s.bitrate} kbps` : ""].filter(Boolean).join(" ");
// "english,german" -> "English, German"
const languages = (s: string) => s.split(",").map((l) => l.trim().replace(/\b\w/g, (c) => c.toUpperCase())).filter(Boolean).join(", ");
/** Only http(s) homepages become links; the field is user-submitted. */
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : null);

// Turning the knob previews stations on the LCD; it tunes in once the hand rests this long.
const SETTLE_MS = 450;
// The knob sweeps 270° (-135° to +135°) from the first channel to the last.
const SWEEP = 135;
/** Pointer angle in degrees around the element's centre (clockwise, screen coordinates). */
const angleAround = (el: Element, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
};

export function RadioPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [current, setCurrent] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Loading stations…");
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState("");
  const [picking, setPicking] = useState(false);

  // Dial position (station index). While `tuning`, the LCD previews stations[dial] before it plays.
  const [dial, setDial] = useState(0);
  const [tuning, setTuning] = useState(false);
  const dialRef = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  // While dragging, the knob follows the hand freely (`turning`); on release it settles onto the channel.
  const drag = useRef<{ last: number; angle: number } | null>(null);
  const [turning, setTurning] = useState<number | null>(null);

  const list = useRef<HTMLUListElement>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  // Code match, then name prefix, then substring, so Enter on "ind" picks India.
  const rank = (c: Country) => {
    const n = c.name.toLowerCase();
    return c.iso_3166_1.toLowerCase() === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : -1;
  };
  const shownCountries = [{ name: "All countries", iso_3166_1: "", stationcount: 0 }, ...countries]
    .filter((c) => !q || rank(c) >= 0)
    .sort((a, b) => (q ? rank(a) - rank(b) : 0));
  const countryName = countries.find((c) => c.iso_3166_1 === country)?.name ?? "All countries";

  function openPicker() {
    setQuery("");
    setPicking(true);
    // focus after the pane stops being inert; preventScroll keeps the slide animation in control
    requestAnimationFrame(() => searchBox.current?.focus({ preventScroll: true }));
  }

  function pickCountry(code: string) {
    if (code !== country) {
      setStatus("Loading stations…");
      setCountry(code);
    }
    setPicking(false);
  }

  useEffect(() => {
    fetch(`${API}/api/radio/countries`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Country[]) =>
        setCountries(
          list.filter((c) => c.iso_3166_1 && c.stationcount > 0).sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let stale = false; // ignore responses from a country the user already switched away from
    fetch(`${API}/api/radio/top${country ? `?country=${country}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: Station[]) => {
        if (stale) return;
        setStations(list);
        setStatus(list.length ? "Pick a station" : "No stations here");
        // New band: park the dial on the playing station if it's in this list, else channel 1.
        clearTimeout(settle.current);
        setTuning(false);
        const i = Math.max(0, list.findIndex((s) => s.stationuuid === current?.stationuuid));
        dialRef.current = i;
        setDial(i);
      })
      .catch(() => !stale && setStatus("Couldn't load stations"));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the country changes
  }, [country]);

  // Keep the dial's channel in view in the list as the knob turns. Scrolls only the list:
  // scrollIntoView would also scroll the clipped sliding track and break the country-picker slide.
  useEffect(() => {
    const ul = list.current;
    const li = ul?.children[dial] as HTMLElement | undefined;
    if (!ul || !li) return;
    const top = li.offsetTop;
    const bottom = top + li.offsetHeight - ul.clientHeight;
    if (top < ul.scrollTop) ul.scrollTo({ top, behavior: "smooth" });
    else if (bottom > ul.scrollTop) ul.scrollTo({ top: bottom, behavior: "smooth" });
  }, [dial]);

  // Stop a pending knob tune if the page goes away mid-turn.
  useEffect(() => () => clearTimeout(settle.current), []);

  async function play(s: Station) {
    const el = audio.current!;
    clearTimeout(settle.current);
    setTuning(false);
    const i = stations.indexOf(s);
    if (i >= 0) {
      dialRef.current = i;
      setDial(i);
    }
    setCurrent(s);
    setStatus("Tuning…");
    el.src = `${API}/api/radio/stream/${s.stationuuid}`; // proxied: adds CORS for the equalizer
    try {
      await el.play();
    } catch {
      setStatus("Station unavailable");
    }
  }

  function toggle() {
    const el = audio.current!;
    if (!current) return stations[dial] && play(stations[dial]);
    if (el.paused) el.play().catch(() => setStatus("Station unavailable"));
    else el.pause();
  }

  /** Move the dial to channel `i`; tunes in after the knob rests (or at once when `now`). */
  function tuneTo(i: number, now = false) {
    if (!stations.length) return;
    const next = Math.min(stations.length - 1, Math.max(0, i));
    if (next === dialRef.current && !now) return;
    dialRef.current = next;
    setDial(next);
    clearTimeout(settle.current);
    if (now) return void play(stations[next]);
    setTuning(true);
    settle.current = setTimeout(() => play(stations[next]), SETTLE_MS);
  }

  const shown = tuning ? stations[dial] : (current ?? stations[dial]);
  const onAir = !tuning && playing;
  const n = stations.length;
  const at = (i: number) => (n > 1 ? i / (n - 1) : 0.5); // 0..1 position on the dial
  const knobAngle = -SWEEP + at(dial) * 2 * SWEEP;
  const major = (i: number) => i === 0 || (i + 1) % 10 === 0;
  const busy = tuning || status === "Tuning…" || status === "Buffering…";
  // "On air" is set when audio starts; once paused that status is stale, so say so.
  const lcdStatus = tuning ? "Tuning" : playing ? "On air" : status === "On air" ? "Paused" : status.replace("…", "");
  const tags = (shown?.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const location = [shown?.state, shown?.country].filter(Boolean).join(", ");
  const homepage = safeUrl(shown?.homepage);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      {/* ---------- Receiver ---------- */}
      <div className="surface-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto my-auto flex w-full max-w-4xl flex-col gap-5 py-2">
          <section aria-label="Radio receiver" className="faceplate rounded-[1.75rem] p-5 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
              {/* LCD */}
              <div className="lcd relative flex min-w-0 flex-1 flex-col justify-between gap-3 overflow-hidden rounded-xl px-5 py-4 font-dot">
                <div className="flex items-center justify-between gap-3 text-sm font-bold tracking-wider">
                  <span className="truncate" aria-live="polite">
                    {lcdStatus}
                  </span>
                  <span className="tabular-nums">{n ? `CH ${pad(dial + 1)}/${pad(n)}` : "CH --"}</span>
                </div>
                {/* Keyed by station: each new station re-mounts the line, replaying the backlight flicker */}
                <p
                  key={shown?.stationuuid ?? "none"}
                  title={shown?.name.trim()}
                  className={`animate-lcd-in truncate text-[clamp(1.75rem,1rem+2.6vw,3rem)] leading-none font-black ${tuning ? "opacity-70" : ""}`}
                >
                  {shown?.name.trim() || "- - - -"}
                </p>
                <div className="flex items-end justify-between gap-4 text-sm font-bold">
                  <span className="truncate">
                    {shown ? [format(shown), shown.countrycode].filter(Boolean).join("  ") : "Turn the dial"}
                  </span>
                  <Visualizer active={onAir} className="h-6 w-28 shrink-0 text-[#4a3220] sm:w-36" />
                </div>
              </div>

              {/* Tuning knob: turn it by dragging around its centre, scroll, or arrow keys; the station plays once you let go */}
              <div className="flex shrink-0 flex-row items-center justify-center gap-6 sm:flex-col sm:justify-between sm:gap-3">
                <div className="relative grid size-32 place-items-center">
                  {/* Lit ring behind the knob, brighter while on air */}
                  <span
                    aria-hidden
                    className={`absolute inset-0 rounded-full transition-[box-shadow,opacity] duration-(--duration-slow) ${
                      onAir
                        ? "shadow-[0_0_0_2px_rgb(255_113_56/0.9),0_0_24px_4px_rgb(255_113_56/0.45)]"
                        : "shadow-[0_0_0_2px_rgb(255_113_56/0.25)]"
                    }`}
                  />
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Tuning"
                    aria-valuemin={1}
                    aria-valuemax={Math.max(1, n)}
                    aria-valuenow={dial + 1}
                    aria-valuetext={stations[dial] ? `Channel ${dial + 1}, ${stations[dial].name.trim()}` : "No stations"}
                    onKeyDown={(e) => {
                      const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
                      if (step) tuneTo(dialRef.current + step);
                      else if (e.key === "Home") tuneTo(0);
                      else if (e.key === "End") tuneTo(n - 1);
                      else if (e.key === "Enter" || e.key === " ") tuneTo(dialRef.current, true);
                      else return;
                      e.preventDefault();
                    }}
                    onWheel={(e) => tuneTo(dialRef.current + (e.deltaY < 0 ? 1 : -1))}
                    onPointerDown={(e) => {
                      if (!n) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { last: angleAround(e.currentTarget, e.clientX, e.clientY), angle: knobAngle };
                      setTurning(knobAngle);
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (!d) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      // Near the centre the angle swings wildly with tiny movements; ignore that zone.
                      if (Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < 10) return;
                      const a = angleAround(e.currentTarget, e.clientX, e.clientY);
                      const delta = ((a - d.last + 540) % 360) - 180; // shortest way round, so crossing ±180° doesn't jump
                      d.last = a;
                      d.angle = Math.min(SWEEP, Math.max(-SWEEP, d.angle + delta)); // hard stops at both ends
                      setTurning(d.angle);
                      tuneTo(Math.round(((d.angle + SWEEP) / (2 * SWEEP)) * (n - 1)));
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                      setTurning(null);
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      setTurning(null);
                    }}
                    className={`relative size-28 cursor-grab touch-none rounded-full bg-[conic-gradient(from_0deg,#3d4555,#262c38_12%,#3d4555_25%,#1f242e_37%,#3d4555_50%,#262c38_62%,#3d4555_75%,#1f242e_87%,#3d4555)] shadow-[0_10px_24px_-6px_rgb(0_0_0/0.8),0_2px_4px_rgb(0_0_0/0.5),inset_0_1px_0_rgb(255_255_255/0.15)] outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60 active:cursor-grabbing ${
                      turning === null ? "transition-transform duration-(--duration-base) ease-(--ease-out-soft)" : ""
                    }`}
                    style={{ transform: `rotate(${turning ?? knobAngle}deg)` }}
                  >
                    {/* Machined cap and the indicator notch */}
                    <span aria-hidden className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_35%_30%,#465063,#232935_70%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_3px_rgb(0_0_0/0.6)]" />
                    <span aria-hidden className="absolute top-2.5 left-1/2 h-4 w-1 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_6px_rgb(255_113_56/0.8)]" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={toggle}
                    disabled={!n && !current}
                    aria-label={playing ? "Pause" : "Play"}
                    className="grid size-12 place-items-center rounded-full bg-[linear-gradient(180deg,#2e3543,#1d222c)] text-primary shadow-[0_4px_10px_-2px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.1)] transition-[transform,box-shadow] duration-(--duration-fast) hover:shadow-[0_4px_10px_-2px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(255_113_56/0.4)] focus-visible:outline-2 focus-visible:outline-primary active:scale-95 active:shadow-recess disabled:opacity-40"
                  >
                    <span className="[&_svg]:size-5">
                      <PlayGlyph playing={playing} />
                    </span>
                  </button>
                  <div className="flex flex-col gap-1.5 text-caption text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="led" data-on={onAir || undefined} /> On air
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`led ${busy ? "animate-pulse" : ""}`} data-on={busy || undefined} />
                      Tuning
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dial scale: one tick per station; click anywhere to tune there */}
            <div
              aria-hidden
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                tuneTo(Math.round(((e.clientX - r.left) / r.width) * (n - 1)), true);
              }}
              className="well relative mt-6 h-14 cursor-pointer rounded-lg px-4"
            >
              <div className="relative h-full">
                {stations.map((s, i) => (
                  <span
                    key={s.stationuuid}
                    className={`absolute bottom-3 w-px -translate-x-1/2 ${
                      major(i) ? "h-5 bg-foreground/50" : (i + 1) % 5 === 0 ? "h-3.5 bg-foreground/30" : "h-2 bg-foreground/20"
                    }`}
                    style={{ left: `${at(i) * 100}%` }}
                  />
                ))}
                {stations.map((_, i) =>
                  major(i) ? (
                    <span key={i} className="readout absolute top-1 -translate-x-1/2 text-[0.625rem] text-dim" style={{ left: `${at(i) * 100}%` }}>
                      {i + 1}
                    </span>
                  ) : null,
                )}
                {/* Needle */}
                <span
                  className="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px_1px_rgb(255_113_56/0.7)] transition-[left] duration-(--duration-slow) ease-(--ease-out-soft)"
                  style={{ left: `${at(dial) * 100}%` }}
                />
              </div>
            </div>
          </section>

          {/* Station details, from whatever Radio-Browser has on file. Fixed shape (one line per value,
              one line of tags, a reserved link column) so the panel never changes size between stations. */}
          <section aria-label="Station details" className="surface-1 grid gap-4 rounded-2xl p-5 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
            <dl className="grid min-w-0 grid-cols-2 gap-x-6 gap-y-3 text-body sm:grid-cols-4">
              {[
                ["Location", location],
                ["Language", shown?.language ? languages(shown.language) : ""],
                ["Format", shown ? format(shown) : ""],
                ["Votes", shown?.votes ? shown.votes.toLocaleString() : ""],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-caption text-muted-foreground">{k}</dt>
                  <dd title={v || undefined} className={`truncate ${v ? "" : "text-dim"}`}>
                    {v || (shown ? "Not listed" : "—")}
                  </dd>
                </div>
              ))}
              {/* Tags clip to one line rather than wrapping onto a second */}
              <div className="col-span-full flex h-6 flex-wrap gap-1.5 overflow-hidden">
                {tags.length ? (
                  tags.map((t) => (
                    <span key={t} className="rounded-full border border-hairline px-2.5 py-0.5 text-caption text-muted-foreground">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="py-0.5 text-caption text-dim">
                    {shown ? "No tags" : status === "Loading stations…" ? status : "Turn the dial or pick a station from the list."}
                  </span>
                )}
              </div>
            </dl>
            {homepage ? (
              <a
                href={homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 self-start text-body text-glow transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary sm:justify-self-end"
              >
                Station website <ExternalLink className="size-3.5" />
              </a>
            ) : (
              <span className="self-start text-body text-dim sm:justify-self-end">No website</span>
            )}
          </section>
        </div>
      </div>

      {/* ---------- Station list + country picker (slides over the list) ---------- */}
      <aside className="surface-1 flex min-h-72 flex-col overflow-hidden rounded-3xl lg:w-80 xl:w-96">
        <motion.div
          className="flex min-h-0 w-[200%] flex-1"
          animate={{ x: picking ? "-50%" : "0%" }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          <div inert={picking} className="flex min-h-0 w-1/2 flex-col gap-3 p-4">
            <header className="flex items-center justify-between gap-3 px-1">
              <div className="min-w-0">
                <h2 className="text-title font-semibold">Stations</h2>
                <p className="truncate text-caption text-muted-foreground">
                  {n ? `${n} most voted in ${countryName}` : status}
                </p>
              </div>
              <button
                onClick={openPicker}
                aria-label={`Choose country, currently ${countryName}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-caption transition-colors hover:border-white/15 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Globe className="size-3.5" />
                {country || "All"}
              </button>
            </header>

            <ul ref={list} className="panel-scroll relative -mx-1 min-h-0 flex-1 overflow-y-auto px-1 [--panel:var(--surface-1)]">
              {!n &&
                status === "Loading stations…" &&
                Array.from({ length: 8 }, (_, i) => (
                  <li key={i} aria-hidden className="flex items-center gap-3 px-3 py-2.5">
                    <span className="skeleton h-3 w-5 rounded" />
                    <span className="flex-1 space-y-1.5">
                      <span className="skeleton block h-3.5 rounded" style={{ width: `${70 - ((i * 13) % 35)}%` }} />
                      <span className="skeleton block h-2.5 w-1/3 rounded" />
                    </span>
                  </li>
                ))}
              {stations.map((s, i) => {
                const selected = s.stationuuid === current?.stationuuid;
                return (
                  <li key={s.stationuuid}>
                    <button
                      onClick={() => play(s)}
                      aria-current={selected || undefined}
                      className={`interactive relative flex w-full items-center gap-3 rounded-lg py-2 pr-3 pl-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                        selected ? "bg-white/[0.05]" : ""
                      }`}
                    >
                      {/* One marker shared by all rows, so it slides to the newly selected station */}
                      {selected && (
                        <motion.span
                          layoutId="station-marker"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary shadow-[0_0_6px_rgb(255_113_56/0.7)]"
                        />
                      )}
                      <span className={`readout w-5 shrink-0 ${i === dial ? "text-primary" : "text-dim"}`}>{pad(i + 1)}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-body ${selected ? "font-medium text-primary" : ""}`}>{s.name.trim()}</span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {[format(s), s.countrycode].filter(Boolean).join("  ")}
                        </span>
                      </span>
                      {selected && playing && <Meter />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div inert={!picking} className="flex min-h-0 w-1/2 flex-col gap-3 p-4">
            <header className="flex items-center gap-2">
              <button
                onClick={() => setPicking(false)}
                aria-label="Back to stations"
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                <ChevronLeft className="size-5" />
              </button>
              <h2 className="text-title font-semibold">Countries</h2>
            </header>
            <label className="well flex items-center gap-2 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-ring/60">
              <Search className="size-4 text-muted-foreground" />
              <input
                ref={searchBox}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && shownCountries[0]) pickCountry(shownCountries[0].iso_3166_1);
                  if (e.key === "Escape") setPicking(false);
                }}
                placeholder="Search countries"
                aria-label="Search countries"
                className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-dim"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <ul className="panel-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1 [--panel:var(--surface-1)]">
              {!shownCountries.length && <li className="px-3 py-2 text-body text-muted-foreground">No matching country</li>}
              {shownCountries.map((c) => (
                <li key={c.iso_3166_1 || "all"}>
                  <button
                    onClick={() => pickCountry(c.iso_3166_1)}
                    className={`interactive flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body ${
                      c.iso_3166_1 === country ? "bg-white/[0.05] text-primary" : ""
                    }`}
                  >
                    {c.iso_3166_1 ? (
                      <span className="readout w-6 text-muted-foreground">{c.iso_3166_1}</span>
                    ) : (
                      <Globe className="size-4 w-6 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">{c.name}</span>
                    {c.stationcount > 0 && <span className="readout text-dim">{c.stationcount}</span>}
                    {c.iso_3166_1 === country && <Check className="size-4" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </aside>

      <audio
        ref={audio}
        crossOrigin="anonymous" // lets the equalizer read the audio (sources send CORS headers)
        onPlay={(e) => {
          pauseOtherAudio(e.currentTarget);
          attachEq(e.currentTarget);
        }}
        onPlaying={() => {
          setPlaying(true);
          setStatus("On air");
        }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setStatus("Buffering…")}
        onError={() => {
          setPlaying(false);
          setStatus("Station unavailable");
        }}
      />
    </div>
  );
}
