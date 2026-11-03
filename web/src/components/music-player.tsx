"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, ListEnd, Pause, Play, Search, X } from "lucide-react";
import { Artwork, usePlayer, type Track } from "@/components/player";
import { AddToPlaylist, LikeButton } from "@/components/track-actions";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/audio";
import { Meter, PlayGlyph } from "@/components/visualizer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const rankLabel = (n: number) => String(n).padStart(2, "0");

/** Adds a track to the end of the queue; confirms with a check for a moment. */
function QueueButton({ track }: { track: Track }) {
  const p = usePlayer();
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        p.addToQueue(track);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      aria-label={`Add ${track.title} to queue`}
      className="grid size-8 shrink-0 place-items-center rounded-full opacity-60 transition-[color,opacity,scale] duration-(--duration-fast) hover:text-primary hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary active:scale-90"
    >
      {done ? <Check className="size-4 text-primary" /> : <ListEnd className="size-4" />}
    </button>
  );
}

/** One track row: play area + like + add-to-playlist (separate buttons, so no nesting). */
export function TrackRow({ track, list, extra, rank }: { track: Track; list: Track[]; extra?: ReactNode; rank?: number }) {
  const p = usePlayer();
  const current = track.id === p.current?.id;
  const playing = p.isPlaying(track);
  return (
    <li className={`group/row interactive flex items-center gap-1 rounded-xl pr-2 ${current ? "bg-white/[0.05]" : ""}`}>
      <button
        onClick={() => p.playTrack(list, track)}
        aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        {rank && <span className="readout w-6 shrink-0 text-right text-muted-foreground">{rankLabel(rank)}</span>}
        <span className={`relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-2 transition-shadow duration-(--duration-base) ${current ? "playing-glow" : ""}`}>
          <Artwork track={track} className="size-full group-hover/row:scale-110" />
          <span
            className={`absolute inset-0 grid place-items-center bg-black/55 text-foreground transition-opacity duration-(--duration-fast) ${
              current ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100"
            }`}
          >
            {playing ? (
              <span className="group-hover/row:hidden">
                <Meter />
              </span>
            ) : null}
            {playing ? (
              <Pause className="hidden size-4 group-hover/row:block" fill="currentColor" />
            ) : (
              <Play className="size-4" fill="currentColor" />
            )}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-medium ${current ? "text-primary" : ""}`}>{track.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{track.artist}</span>
        </span>
        <span className="readout text-muted-foreground">{formatTime(track.duration)}</span>
      </button>
      <LikeButton track={track} />
      <AddToPlaylist track={track} />
      {extra}
    </li>
  );
}

/** Cover-led card. Hover (or keyboard focus) lifts it and reveals play + track actions. */
function TrackCard({ track, list, rank }: { track: Track; list: Track[]; rank?: number }) {
  const p = usePlayer();
  const current = track.id === p.current?.id;
  const playing = p.isPlaying(track);
  const reveal = "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100";
  return (
    <li className="group/card w-(--card-w) shrink-0 snap-start">
      <div
        className={`relative aspect-square overflow-hidden rounded-xl bg-surface-2 transition-[translate,box-shadow] duration-(--duration-base) ease-(--ease-out-soft) group-hover/card:-translate-y-1 ${
          current ? "playing-glow" : "shadow-lift group-hover/card:shadow-float"
        }`}
      >
        <Artwork
          track={track}
          className="size-full group-hover/card:scale-[1.05]"
        />
        <div aria-hidden className={`pointer-events-none absolute inset-0 bg-linear-to-t from-black/80 via-black/15 to-black/30 transition-opacity duration-(--duration-base) ${reveal}`} />
        <button
          onClick={() => p.playTrack(list, track)}
          aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}
          className="absolute inset-0 rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        >
          <span
            className={`absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-ember transition-[opacity,translate,scale] duration-(--duration-base) ease-(--ease-out-soft) hover:scale-110 active:scale-95 ${
              current
                ? "opacity-100"
                : "translate-y-2 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100"
            }`}
          >
            <PlayGlyph playing={playing} />
          </span>
        </button>
        <div className={`absolute top-2 right-2 flex rounded-full bg-black/50 text-foreground backdrop-blur-sm transition-opacity duration-(--duration-base) ${reveal}`}>
          <QueueButton track={track} />
          <LikeButton track={track} />
          <AddToPlaylist track={track} />
        </div>
      </div>
      <div className="mt-3 flex gap-2.5">
        {rank && <span className="readout pt-1 text-glow">{rankLabel(rank)}</span>}
        <div className="min-w-0 flex-1">
          <p className={`flex items-center gap-2 font-medium ${current ? "text-primary" : ""}`}>
            <span className="truncate">{track.title}</span>
            {playing && <Meter />}
          </p>
          <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
        </div>
      </div>
    </li>
  );
}

/** Titled horizontal row with arrow buttons for mouse users; scrolls by about one screen of cards. */
function Shelf({ title, children, cardWidth }: { title: string; children: ReactNode; cardWidth: string }) {
  const row = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section>
      <header className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-heading font-semibold">{title}</h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => scroll(-1)} aria-label={`Scroll ${title} back`}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => scroll(1)} aria-label={`Scroll ${title} forward`}>
            <ChevronRight />
          </Button>
        </div>
      </header>
      {/* Vertical padding leaves room for the hover lift and focus ring inside the scroller's clip */}
      <ul
        ref={row}
        style={{ "--card-w": cardWidth } as React.CSSProperties}
        className="surface-scroll -mx-2 flex snap-x snap-mandatory scroll-px-2 gap-5 overflow-x-auto px-2 pt-2 pb-4"
      >
        {children}
      </ul>
    </section>
  );
}

/** The current #1 on trending, shown large with its own cover as the backdrop. */
function Spotlight({ track, list }: { track: Track; list: Track[] }) {
  const p = usePlayer();
  const playing = p.isPlaying(track);
  return (
    <section aria-label="Top trending track" className="surface-1 relative isolate overflow-hidden rounded-3xl">
      <Artwork track={track} className="absolute inset-0 -z-20 size-full scale-125 opacity-60 blur-3xl" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-r from-background/90 via-background/55 to-background/10" />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:gap-7 lg:p-7">
        <Artwork track={track} className="size-36 shrink-0 rounded-xl shadow-float lg:size-48" />
        <div className="min-w-0 flex-1">
          <p className="text-body text-glow">Number one on Audius trending</p>
          <h2 className="mt-1 line-clamp-2 text-display font-semibold break-words">{track.title}</h2>
          <p className="mt-2 flex items-center gap-3 text-muted-foreground">
            <span className="truncate">{track.artist}</span>
            <span className="readout">{formatTime(track.duration)}</span>
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Button size="transport" onClick={() => p.playTrack(list, track)} aria-label={`${playing ? "Pause" : "Play"} ${track.title}`}>
              <PlayGlyph playing={playing} />
            </Button>
            <div className="ml-2 flex">
              <QueueButton track={track} />
              <LikeButton track={track} />
              <AddToPlaylist track={track} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Placeholder covers while trending loads, so the layout doesn't jump. */
function CardSkeletons({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <li key={i} aria-hidden className="w-(--card-w) shrink-0">
      <div className="skeleton aspect-square rounded-xl" />
      <div className="skeleton mt-3 h-3.5 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded" />
    </li>
  ));
}

function SearchBar({ query, setQuery }: { query: string; setQuery: (q: string) => void }) {
  const input = useRef<HTMLInputElement>(null);

  // "/" jumps to search, like most desktop players; ignored while typing elsewhere or when this tab is hidden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = input.current;
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]");
      if (e.key !== "/" || typing || !el?.offsetParent) return;
      e.preventDefault();
      el.focus();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <label className="group/search well flex h-12 shrink-0 items-center gap-3 rounded-full px-5 transition-shadow duration-(--duration-base) ease-(--ease-out-soft) focus-within:shadow-[var(--shadow-recess),0_0_0_2px_rgb(255_113_56/0.55),0_0_24px_-4px_rgb(255_113_56/0.35)]">
      <Search className="size-4 text-muted-foreground transition-colors duration-(--duration-base) group-focus-within/search:text-primary" />
      <input
        ref={input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setQuery("")}
        placeholder="Search tracks and artists"
        aria-label="Search music"
        maxLength={100}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-dim"
      />
      {query ? (
        <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground transition-colors hover:text-foreground">
          <X className="size-4" />
        </button>
      ) : (
        <kbd className="readout hidden rounded-md border border-hairline px-1.5 py-0.5 text-dim sm:block group-focus-within/search:hidden">/</kbd>
      )}
    </label>
  );
}

export function MusicPlayer() {
  const p = usePlayer();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState("Loading…");
  // The dock's Play starts these when nothing is loaded.
  const { offer } = p;
  useEffect(() => offer(tracks), [offer, tracks]);

  // Trending when the box is empty, otherwise a debounced search.
  useEffect(() => {
    const q = query.trim();
    let stale = false;
    const t = setTimeout(
      () => {
        setStatus("Loading…");
        fetch(q ? `${API}/api/music/search?q=${encodeURIComponent(q)}` : `${API}/api/music/trending`)
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((list: Track[]) => {
            if (stale) return;
            setTracks(list);
            setStatus(list.length ? "" : "No tracks found");
          })
          .catch(() => !stale && setStatus("Couldn't load tracks"));
      },
      q ? 400 : 0,
    );
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [query]);

  const searching = query.trim() !== "";
  const loading = status === "Loading…";
  const [top, ...popular] = tracks;

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <SearchBar query={query} setQuery={setQuery} />

        <div className="surface-scroll -mx-2 flex min-h-0 flex-1 flex-col gap-9 overflow-y-auto px-2 pb-4 *:shrink-0">
          {searching ? (
            <section>
              <h2 className="mb-4 text-heading font-semibold">
                {loading ? "Searching…" : `Results for “${query.trim()}”`}
              </h2>
              {status && !loading && <p className="text-muted-foreground">{status}</p>}
              <ul
                style={{ "--card-w": "100%" } as React.CSSProperties}
                className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-7"
              >
                {loading ? <CardSkeletons count={12} /> : tracks.map((t) => <TrackCard key={t.id} track={t} list={tracks} />)}
              </ul>
            </section>
          ) : (
            <>
              {top && <Spotlight track={top} list={tracks} />}
              {status && !loading && (
                <p className="text-muted-foreground">
                  {status === "No tracks found" ? "Trending is empty right now. Try a search." : `${status}. Check that the API server is running.`}
                </p>
              )}

              {(loading || popular.length > 0) && (
                <Shelf title="Popular right now" cardWidth="clamp(10rem, 13vw, 13rem)">
                  {loading ? (
                    <CardSkeletons count={8} />
                  ) : (
                    popular.slice(0, 12).map((t, i) => <TrackCard key={t.id} track={t} list={tracks} rank={i + 2} />)
                  )}
                </Shelf>
              )}

              {p.recent.length > 0 && (
                <Shelf title="Recently played" cardWidth="clamp(8.5rem, 10vw, 10.5rem)">
                  {p.recent.map((t) => (
                    <TrackCard key={t.id} track={t} list={p.recent} />
                  ))}
                </Shelf>
              )}

              {popular.length > 12 && (
                <section>
                  <h2 className="mb-3 text-heading font-semibold">More from the chart</h2>
                  <ul className="grid gap-x-6 gap-y-0.5 2xl:grid-cols-2">
                    {popular.slice(12).map((t, i) => (
                      <TrackRow key={t.id} track={t} list={tracks} rank={i + 14} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
