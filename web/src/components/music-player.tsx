"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Search, X } from "lucide-react";
import { Artwork, NowPlaying, usePlayer, type Track } from "@/components/player";
import { AddToPlaylist, LikeButton } from "@/components/track-actions";
import { formatTime } from "@/lib/audio";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** One track row: play area + like + add-to-playlist (separate buttons, so no nesting). */
export function TrackRow({ track, list, extra }: { track: Track; list: Track[]; extra?: React.ReactNode }) {
  const p = usePlayer();
  return (
    <li
      className={`flex items-center gap-1 rounded-2xl pr-2 transition-shadow hover:bg-black/[0.03] ${
        track.id === p.current?.id ? "neu" : ""
      }`}
    >
      <button
        onClick={() => p.playTrack(list, track)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Artwork track={track} className="size-11 shrink-0 rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{track.title}</span>
          <span className="block truncate text-sm text-muted-foreground">{track.artist}</span>
        </span>
        <span className="text-xs text-muted-foreground">{formatTime(track.duration)}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
          {p.isPlaying(track) ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </span>
      </button>
      <LikeButton track={track} />
      <AddToPlaylist track={track} />
      {extra}
    </li>
  );
}

export function MusicPlayer() {
  const p = usePlayer();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [status, setStatus] = useState("Loading…");

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

  const discs = tracks.slice(0, 8);
  const rest = tracks.slice(8);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <label className="neu-inset flex shrink-0 items-center gap-3 rounded-full px-5 py-3 focus-within:ring-2 focus-within:ring-primary">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search music"
          aria-label="Search music"
          maxLength={100}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      <section className="shrink-0">
        <h2 className="mb-4 text-xl font-semibold">
          {query.trim() ? `Results for "${query.trim()}"` : "Recommendation for You"}
        </h2>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        <ul className="surface-scroll -mx-2 flex gap-6 overflow-x-auto px-2 pb-3">
          {discs.map((t) => (
            <li key={t.id} className="w-40 shrink-0 text-center [@media(max-height:760px)]:w-28">
              <button
                onClick={() => p.playTrack(tracks, t)}
                className="group w-full rounded-full focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={`Play ${t.title}`}
              >
                {/* Vinyl: spins while this track plays, holds its angle when paused */}
                <div
                  className="neu relative size-40 animate-spin [@media(max-height:760px)]:size-28 overflow-hidden rounded-full border-[6px] border-[#2b2d33] [animation-duration:8s]"
                  style={{ animationPlayState: p.isPlaying(t) ? "running" : "paused" }}
                >
                  <Artwork track={t} className="size-full" />
                  <span className="absolute inset-0 m-auto size-8 rounded-full bg-background shadow-inner" />
                </div>
              </button>
              <p className="mt-3 truncate font-medium">{t.title}</p>
              <p className="truncate text-sm text-muted-foreground">{t.artist}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex min-h-0 flex-1 gap-6">
        <section className="neu flex min-h-0 flex-1 flex-col rounded-3xl p-5">
          <h2 className="mb-3 font-semibold">More tracks</h2>
          <ul className="surface-scroll -mx-2 min-h-0 flex-1 overflow-y-auto px-2">
            {rest.map((t) => (
              <TrackRow key={t.id} track={t} list={tracks} />
            ))}
          </ul>
        </section>
        <NowPlaying fallback={tracks} />
      </div>
    </div>
  );
}
