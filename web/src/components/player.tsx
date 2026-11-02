"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Visualizer } from "@/components/visualizer";
import { LikeButton } from "@/components/track-actions";
import { attachEq, formatTime, pauseOtherAudio } from "@/lib/audio";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Track = { id: string; title: string; artist: string; duration: number; artwork: string | null };

export function Artwork({ track, className = "" }: { track: Track; className?: string }) {
  // Remember which URL failed (not a boolean) so the now-playing card recovers when the track changes.
  const [broken, setBroken] = useState<string | null>(null);
  return track.artwork && broken !== track.artwork ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote Audius CDN art; next/image would need per-host config
    <img src={track.artwork} alt="" onError={() => setBroken(track.artwork)} className={`object-cover ${className}`} />
  ) : (
    <div className={`bg-gradient-to-br from-primary to-panel ${className}`} />
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
  const current = queue[index];

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
    el.src = `${API}/api/music/stream/${list[i].id}`;
    el.play().catch(() => {});
  }

  function toggle(fallback: Track[] = []) {
    const el = audio.current!;
    if (!current) return void (fallback.length && start(fallback, 0));
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

/** Compact now-playing card, bottom-right like the design; `fallback` is what Play starts when idle. */
export function NowPlaying({ fallback = [] }: { fallback?: Track[] }) {
  const p = usePlayer();
  const VolumeIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;

  return (
    <section
      className="neu-panel flex w-80 shrink-0 flex-col gap-3 self-end rounded-3xl bg-panel px-5 py-4 text-panel-foreground"
      aria-label="Now playing"
    >
      <Visualizer active={p.playing} className="h-7" />
      <div className="flex items-center gap-3">
        {p.current ? (
          <Artwork track={p.current} className="size-12 shrink-0 rounded-full" />
        ) : (
          <div className="size-12 shrink-0 rounded-full bg-white/10" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{p.current?.title ?? "Nothing playing"}</p>
          <p className="truncate text-xs opacity-60">
            {p.failed ? "Track unavailable" : (p.current?.artist ?? "Pick a track")}
          </p>
        </div>
        {p.current && <LikeButton track={p.current} className="text-panel-foreground" />}
        <button
          onClick={() => p.step(-1)}
          aria-label="Previous"
          disabled={!p.current}
          className="opacity-80 hover:opacity-100 disabled:opacity-30"
        >
          <SkipBack className="size-4" />
        </button>
        <button
          onClick={() => p.toggle(fallback)}
          aria-label={p.playing ? "Pause" : "Play"}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_14px_rgb(242_107_29/0.5)] focus-visible:outline-2 focus-visible:outline-white"
        >
          {p.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          onClick={() => p.step(1)}
          aria-label="Next"
          disabled={!p.current}
          className="opacity-80 hover:opacity-100 disabled:opacity-30"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="w-8 opacity-60">{formatTime(p.time)}</span>
        <Slider
          aria-label="Seek"
          value={[p.time]}
          max={p.duration || 1}
          disabled={!p.current}
          onValueChange={(v) => p.seek(Array.isArray(v) ? v[0] : v)}
        />
        <span className="w-8 text-right opacity-60">{formatTime(p.duration)}</span>
      </div>
      {/* Volume: click the icon to mute, drag/arrow keys, or scroll the wheel anywhere on the row */}
      <div className="flex items-center gap-3" onWheel={(e) => p.changeVolume(p.volume - Math.sign(e.deltaY) * 0.05)}>
        <button
          onClick={() => p.setMuted(!p.muted)}
          aria-label={p.muted ? "Unmute" : "Mute"}
          className="opacity-80 hover:opacity-100"
        >
          <VolumeIcon className="size-4" />
        </button>
        <Slider
          aria-label="Volume"
          value={[p.muted ? 0 : p.volume]}
          max={1}
          step={0.01}
          onValueChange={(v) => p.changeVolume(Array.isArray(v) ? v[0] : v)}
        />
        <span className="w-8 text-right text-xs tabular-nums opacity-60">
          {Math.round((p.muted ? 0 : p.volume) * 100)}
        </span>
      </div>
    </section>
  );
}
