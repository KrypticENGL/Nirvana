"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { attachEq, pauseOtherAudio } from "@/lib/audio";
import { Check, ChevronLeft, Globe, Pause, Play, Search, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Station = { stationuuid: string; name: string; url_resolved: string; codec: string; bitrate: number };
type Country = { name: string; iso_3166_1: string; stationcount: number };

// Raised round control on the slate panel; presses in when clicked.
const knob =
  "bg-panel shadow-[6px_6px_14px_rgb(0_0_0/0.35),-4px_-4px_10px_rgb(255_255_255/0.12)] active:shadow-inner focus-visible:outline-2 focus-visible:outline-primary";

export function RadioPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [current, setCurrent] = useState<Station | null>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState("Loading stations…");
  const [countries, setCountries] = useState<Country[]>([]);
  const [country, setCountry] = useState("");
  const [picking, setPicking] = useState(false);

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
      })
      .catch(() => !stale && setStatus("Couldn't load stations"));
    return () => {
      stale = true;
    };
  }, [country]);

  async function play(s: Station) {
    const el = audio.current!;
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
    if (!current) return stations[0] && play(stations[0]);
    if (el.paused) el.play().catch(() => setStatus("Station unavailable"));
    else el.pause();
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Two panes side by side; the track slides left to reveal the country picker. */}
      <motion.div
        className="flex w-[200%] shrink-0"
        animate={{ x: picking ? "-50%" : "0%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <div inert={picking} className="flex min-h-0 w-1/2 flex-col gap-4 p-6">
          <header className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Radio Player</h2>
            <button
              onClick={openPicker}
              aria-label="Choose country"
              className={`${knob} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs`}
            >
              <Globe className="size-4" />
              {country || "All"}
            </button>
          </header>

          <div className="rounded-2xl bg-[#c9ccc4] p-4 font-dot text-[#2b2d2a] shadow-inner">
            <p className="truncate text-sm font-bold uppercase tracking-widest">{playing ? "Now playing…" : status}</p>
            <p className="truncate text-3xl font-black uppercase">{current?.name.trim() || "- - -"}</p>
            {current && (
              <p className="text-sm font-bold uppercase">
                {current.codec} {current.bitrate ? `${current.bitrate}kbps` : ""}
              </p>
            )}
          </div>

          <button
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className={`${knob} mx-auto grid size-16 place-items-center rounded-full`}
          >
            {playing ? <Pause className="size-6" /> : <Play className="size-6 text-primary" />}
          </button>

          <ul className="panel-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2">
            {stations.map((s) => (
              <li key={s.stationuuid}>
                <button
                  onClick={() => play(s)}
                  className={`w-full truncate rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10 ${
                    s.stationuuid === current?.stationuuid ? "bg-white/10 text-primary" : ""
                  }`}
                >
                  {s.name.trim()}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div inert={!picking} className="flex min-h-0 w-1/2 flex-col gap-4 p-6">
          <header className="flex items-center gap-3">
            <button
              onClick={() => setPicking(false)}
              aria-label="Back to player"
              className={`${knob} grid size-9 place-items-center rounded-full`}
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="text-xl font-semibold">Countries</h2>
          </header>
          <label className="flex items-center gap-2 rounded-xl px-3 py-2 shadow-[inset_3px_3px_6px_rgb(0_0_0/0.35),inset_-2px_-2px_5px_rgb(255_255_255/0.08)] focus-within:ring-2 focus-within:ring-primary">
            <Search className="size-4 opacity-60" />
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
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-panel-foreground/50"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="opacity-60 hover:opacity-100">
                <X className="size-4" />
              </button>
            )}
          </label>
          <ul className="panel-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2">
            {!shownCountries.length && <li className="px-3 py-2 text-sm opacity-60">No matching country</li>}
            {shownCountries.map((c) => (
              <li key={c.iso_3166_1 || "all"}>
                <button
                  onClick={() => pickCountry(c.iso_3166_1)}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10 ${
                    c.iso_3166_1 === country ? "bg-white/10 text-primary" : ""
                  }`}
                >
                  {c.iso_3166_1 ? (
                    <span className="w-6 font-mono text-xs opacity-60">{c.iso_3166_1}</span>
                  ) : (
                    <Globe className="size-4 w-6 opacity-60" />
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.stationcount > 0 && <span className="text-xs opacity-50">{c.stationcount}</span>}
                  {c.iso_3166_1 === country && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      <audio
        ref={audio}
        crossOrigin="anonymous" // lets the equalizer read the audio (sources send CORS headers)
        onPlay={(e) => {
          pauseOtherAudio(e.currentTarget);
          attachEq(e.currentTarget);
        }}
        onPlaying={() => setPlaying(true)}
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
