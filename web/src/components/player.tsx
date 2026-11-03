"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { attachEq, pauseOtherAudio } from "@/lib/audio";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const RECENT_KEY = "nirvana:recent";
const RECENT_MAX = 20;
const NO_TRACKS: Track[] = [];

// Play history lives in localStorage; parsed once per change so the snapshot stays referentially stable.
let recentRaw: string | null = null;
let recentCache = NO_TRACKS;
const recentListeners = new Set<() => void>();
function readRecent() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RECENT_KEY);
  } catch {} // storage blocked: no history
  if (raw !== recentRaw) {
    recentRaw = raw;
    try {
      const v = JSON.parse(raw ?? "[]");
      recentCache = Array.isArray(v) ? v.slice(0, RECENT_MAX) : NO_TRACKS;
    } catch {
      recentCache = NO_TRACKS;
    }
  }
  return recentCache;
}
function subscribeRecent(fn: () => void) {
  recentListeners.add(fn);
  return () => recentListeners.delete(fn);
}

export type Track = { id: string; title: string; artist: string; duration: number; artwork: string | null };

export function Artwork({ track, className = "" }: { track: Track; className?: string }) {
  // Remember which URL failed (not a boolean) so the now-playing card recovers when the track changes.
  const [broken, setBroken] = useState<string | null>(null);
  // Fades in once decoded, so covers don't pop in row by row; keyed by URL so a track change fades again.
  const [loaded, setLoaded] = useState<string | null>(null);
  return track.artwork && broken !== track.artwork ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote Audius CDN art; next/image would need per-host config
    <img
      src={track.artwork}
      alt=""
      decoding="async"
      onLoad={() => setLoaded(track.artwork)}
      onError={() => setBroken(track.artwork)}
      // Hidden only until loaded, so a caller's own opacity (blurred backdrops) still applies afterwards.
      data-loading={loaded !== track.artwork || undefined}
      className={`object-cover transition-[opacity,scale] duration-(--duration-slow) ease-(--ease-out-soft) data-loading:opacity-0 ${className}`}
    />
  ) : (
    // Missing art: an ember-lit sleeve rather than a flat block, so the grid keeps its rhythm
    <div className={`bg-[radial-gradient(circle_at_30%_25%,var(--glow),var(--primary)_35%,var(--surface-2)_85%)] ${className}`} />
  );
}

// One music <audio> for the whole app, so Music and Library tabs share the same queue and controls.
type Player = {
  current: Track | undefined;
  playing: boolean;
  time: number;
  duration: number;
  failed: boolean;
  volume: number;
  muted: boolean;
  isPlaying: (t: Track) => boolean;
  /** Play `t` from `list` (becomes the queue); clicking the current track toggles pause. */
  playTrack: (list: Track[], t: Track) => void;
  toggle: (fallback?: Track[]) => void;
  step: (dir: 1 | -1) => void;
  seek: (s: number) => void;
  changeVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  /** The play queue and the position of `current` in it. */
  queue: Track[];
  index: number;
  /** Pages register the list Play should start when nothing is loaded (last caller wins). */
  offer: (list: Track[]) => void;
  /** Tracks actually started on this browser, newest first. */
  recent: Track[];
  /** Append to the queue (or start it when nothing is loaded). */
  addToQueue: (t: Track) => void;
};

const PlayerContext = createContext<Player | null>(null);
export const usePlayer = () => useContext(PlayerContext)!;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const recent = useSyncExternalStore(subscribeRecent, readRecent, () => NO_TRACKS);
  const current = queue[index];
  const fallback = useRef<Track[]>([]);
  const offer = useCallback((list: Track[]) => void (fallback.current = list), []);

  function remember(t: Track) {
    const next = [t, ...readRecent().filter((x) => x.id !== t.id)].slice(0, RECENT_MAX);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {} // storage full or blocked: history just isn't kept
    recentListeners.forEach((fn) => fn());
  }

  useEffect(() => {
    audio.current!.volume = volume;
    audio.current!.muted = muted;
  }, [volume, muted]);

  function start(list: Track[], i: number) {
    const el = audio.current!;
    setQueue(list);
    setIndex(i);
    setTime(0);
    setFailed(false);
    setDuration(list[i].duration);
    remember(list[i]);
    el.src = `${API}/api/music/stream/${list[i].id}`;
    el.play().catch(() => {});
  }

  function toggle(list: Track[] = fallback.current) {
    const el = audio.current!;
    if (!current) return void (list.length && start(list, 0));
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function step(dir: 1 | -1) {
    if (!queue.length) return;
    // "previous" restarts the song if it's a few seconds in, like most players
    if (dir === -1 && audio.current!.currentTime > 3) return void (audio.current!.currentTime = 0);
    start(queue, (index + dir + queue.length) % queue.length);
  }

  const player: Player = {
    current,
    playing,
    time,
    duration,
    failed,
    volume,
    muted,
    isPlaying: (t) => playing && t.id === current?.id,
    playTrack: (list, t) =>
      t.id === current?.id
        ? toggle()
        : start(
            list,
            list.findIndex((x) => x.id === t.id),
          ),
    toggle,
    step,
    seek: (s) => {
      audio.current!.currentTime = s;
      setTime(s);
    },
    changeVolume: (v) => {
      setVolume(Math.min(1, Math.max(0, Math.round(v * 100) / 100)));
      setMuted(false);
    },
    setMuted,
    queue,
    index,
    offer,
    recent,
    addToQueue: (t) => {
      if (!current) return start([t], 0);
      if (!queue.some((x) => x.id === t.id)) setQueue([...queue, t]);
    },
  };

  return (
    <PlayerContext.Provider value={player}>
      {children}
      <audio
        ref={audio}
        crossOrigin="anonymous" // lets the equalizer read the audio (sources send CORS headers)
        onPlay={(e) => {
          pauseOtherAudio(e.currentTarget);
          attachEq(e.currentTarget);
        }}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => Number.isFinite(e.currentTarget.duration) && setDuration(e.currentTarget.duration)}
        onEnded={() => step(1)}
        onError={() => {
          setPlaying(false);
          setFailed(true);
        }}
      />
    </PlayerContext.Provider>
  );
}
