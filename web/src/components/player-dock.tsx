"use client";

import { useId, useRef } from "react";
import { ChevronDown, Disc3, ListMusic, Maximize2, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { Artwork, usePlayer, type Track } from "@/components/player";
import { AddToPlaylist, LikeButton } from "@/components/track-actions";
import { Meter, PlayGlyph, Visualizer } from "@/components/visualizer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/audio";

// The dock and the expanded view are two windows onto the one PlayerProvider:
// no audio element or playback state lives here.

function Transport({ big = false }: { big?: boolean }) {
  const p = usePlayer();
  const skip = (dir: 1 | -1) => (
    <Button
      variant="ghost"
      size={big ? "icon-lg" : "icon"}
      className="rounded-xl"
      onClick={() => p.step(dir)}
      aria-label={dir === 1 ? "Next" : "Previous"}
      disabled={!p.current}
    >
      {dir === 1 ? <SkipForward fill="currentColor" /> : <SkipBack fill="currentColor" />}
    </Button>
  );
  return (
    <div className={`flex items-center justify-center ${big ? "gap-5" : "gap-2"}`}>
      {skip(-1)}
      <Button
        size={big ? "transport" : "icon-lg"}
        className={big ? "size-16 rounded-2xl [&_svg:not([class*='size-'])]:size-6" : "size-10 rounded-xl"}
        onClick={() => p.toggle()}
        aria-label={p.playing ? "Pause" : "Play"}
      >
        <PlayGlyph playing={p.playing} />
      </Button>
      {skip(1)}
    </div>
  );
}

/** Seek bar with elapsed and remaining time; the handle shows on hover/focus. */
function Progress() {
  const p = usePlayer();
  const remaining = Math.max(0, p.duration - p.time);
  return (
    <div className="flex items-center gap-3">
      <span className="readout w-10 text-right text-muted-foreground">{formatTime(p.time)}</span>
      <Slider
        aria-label="Seek"
        value={[p.time]}
        max={p.duration || 1}
        disabled={!p.current}
        onValueChange={(v) => p.seek(Array.isArray(v) ? v[0] : v)}
        className="[&_[data-slot=slider-thumb]]:opacity-0 hover:[&_[data-slot=slider-thumb]]:opacity-100 focus-within:[&_[data-slot=slider-thumb]]:opacity-100 data-dragging:[&_[data-slot=slider-thumb]]:opacity-100"
      />
      <span className="readout w-10 text-muted-foreground">{p.current ? `-${formatTime(remaining)}` : formatTime(0)}</span>
    </div>
  );
}

/** Mute toggle + slider; the mouse wheel anywhere on it nudges volume by 5%. */
function Volume({ className = "" }: { className?: string }) {
  const p = usePlayer();
  const level = p.muted ? 0 : p.volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <div className={`group/vol flex items-center gap-2 ${className}`} onWheel={(e) => p.changeVolume(p.volume - Math.sign(e.deltaY) * 0.05)}>
      <Button variant="ghost" size="icon-sm" className="rounded-lg" onClick={() => p.setMuted(!p.muted)} aria-label={p.muted ? "Unmute" : "Mute"}>
        <Icon />
      </Button>
      <Slider
        aria-label="Volume"
        value={[level]}
        max={1}
        step={0.01}
        onValueChange={(v) => p.changeVolume(Array.isArray(v) ? v[0] : v)}
        className="[&_[data-slot=slider-thumb]]:scale-75 group-hover/vol:[&_[data-slot=slider-thumb]]:scale-100 focus-within:[&_[data-slot=slider-thumb]]:scale-100"
      />
      <span className="readout w-7 text-right text-muted-foreground opacity-0 transition-opacity duration-(--duration-fast) group-hover/vol:opacity-100 group-focus-within/vol:opacity-100">
        {Math.round(level * 100)}
      </span>
    </div>
  );
}

/** The live queue; picking a row plays it from there. */
function QueueList() {
  const p = usePlayer();
  if (!p.queue.length)
    return <p className="px-3 py-6 text-center text-body text-muted-foreground">Nothing queued yet. Play something, or use “Add to queue” on any track.</p>;
  return (
    <ol className="surface-scroll min-h-0 overflow-y-auto">
      {p.queue.map((t: Track, i) => {
        const current = i === p.index;
        return (
          <li key={t.id}>
            <button
              onClick={() => p.playTrack(p.queue, t)}
              aria-current={current || undefined}
              className={`interactive flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${current ? "bg-white/[0.05]" : ""}`}
            >
              <span className={`readout w-5 shrink-0 text-right ${current ? "text-primary" : "text-dim"}`}>{i + 1}</span>
              <Artwork track={t} className="size-9 shrink-0 rounded-md bg-surface-2" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-body ${current ? "font-medium text-primary" : ""}`}>{t.title}</span>
                <span className="block truncate text-caption text-muted-foreground">{t.artist}</span>
              </span>
              {current && p.playing ? <Meter /> : <span className="readout text-dim">{formatTime(t.duration)}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Full-window now-playing view: large cover, controls, and the queue alongside. */
function NowPlayingView({ dialog }: { dialog: React.RefObject<HTMLDialogElement | null> }) {
  const p = usePlayer();
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      aria-label="Now playing"
      onClick={(e) => e.target === e.currentTarget && close()}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none translate-y-6 bg-transparent p-0 text-foreground opacity-0 transition-[opacity,translate,display,overlay] transition-discrete duration-(--duration-slow) ease-(--ease-out-soft) backdrop:bg-black/70 backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-(--duration-slow) open:translate-y-0 open:opacity-100 open:backdrop:opacity-100 starting:open:translate-y-6 starting:open:opacity-0 starting:open:backdrop:opacity-0"
    >
      <div className="relative isolate flex size-full flex-col overflow-hidden bg-background">
        {p.current && <Artwork track={p.current} className="absolute inset-0 -z-10 size-full scale-125 opacity-30 blur-3xl" />}
        <header className="flex items-center justify-between px-6 pt-5">
          <p className="text-body text-muted-foreground">Now playing</p>
          <Button variant="ghost" size="icon-lg" className="rounded-xl" onClick={close} aria-label="Close now playing" autoFocus>
            <ChevronDown />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto p-6 pt-2 lg:grid-cols-[minmax(0,1fr)_24rem] lg:overflow-visible lg:p-10 lg:pt-2">
          <div className="flex min-h-0 flex-col items-center justify-center gap-6">
            {/* Cover sized by whichever of width/height runs out first; 76% of the width leaves room for the record */}
            <div className="aspect-square w-full max-w-[min(75vh,40rem)] min-h-40 shrink lg:aspect-auto lg:min-h-0 lg:flex-1 [container-type:size]">
              <div className={`relative mx-auto size-[min(76cqw,100cqh)] ${p.current ? "-translate-x-[12%]" : ""}`}>
                {/* Vinyl: slides out from the sleeve while playing, tucks back when paused; spins only while playing */}
                {p.current && (
                  <div
                    aria-hidden
                    className={`absolute inset-[4%] rounded-full shadow-[0_12px_32px_-8px_rgb(0_0_0/0.8)] transition-transform duration-700 ease-(--ease-out-soft) ${
                      p.playing ? "translate-x-[30%]" : "translate-x-[14%]"
                    }`}
                  >
                    <div
                      className="size-full animate-spin rounded-full bg-[repeating-radial-gradient(circle,#14161b_0_2px,#1c1f26_2px_3px)] [animation-duration:3.6s]"
                      style={{ animationPlayState: p.playing ? "running" : "paused" }}
                    >
                      <Artwork track={p.current} className="absolute inset-[33%] size-[34%] rounded-full" />
                      <span className="absolute inset-[48.5%] rounded-full bg-background" />
                    </div>
                    {/* Fixed sheen: grooves turn underneath it, as on a real record */}
                    <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent,rgb(255_255_255/0.07)_10%,transparent_22%,transparent_50%,rgb(255_255_255/0.05)_60%,transparent_72%)]" />
                  </div>
                )}
                <div className="relative size-full overflow-hidden rounded-2xl bg-surface-2 shadow-float">
                  {p.current ? (
                    <Artwork track={p.current} className="size-full" />
                  ) : (
                    <div className="grid size-full place-items-center text-dim">
                      <Disc3 className="size-16" strokeWidth={1} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex w-full max-w-xl flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-2 text-heading font-semibold break-words">{p.current?.title ?? "Nothing playing"}</h2>
                  <p className="truncate text-muted-foreground">{p.failed ? "Track unavailable" : (p.current?.artist ?? "Pick a track")}</p>
                </div>
                {p.current && (
                  <div className="flex">
                    <LikeButton track={p.current} />
                    <AddToPlaylist track={p.current} />
                  </div>
                )}
              </div>
              <Visualizer active={p.playing} className="h-10" />
              <Progress />
              <Transport big />
              <Volume className="mx-auto w-full max-w-64" />
            </div>
          </div>

          <section aria-label="Queue" className="surface-1 flex max-h-[60vh] min-h-0 flex-col gap-2 rounded-2xl p-3 lg:max-h-none">
            <h3 className="px-2 pt-1 text-title font-semibold">Queue</h3>
            <QueueList />
          </section>
        </div>
      </div>
    </dialog>
  );
}

/** Persistent playback bar along the bottom of the app. */
export function PlayerDock() {
  const p = usePlayer();
  const dialog = useRef<HTMLDialogElement>(null);
  const queueId = useId();
  const anchor = `--queue-${queueId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const expand = () => dialog.current?.showModal();

  return (
    <section
      aria-label="Player"
      className="relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-hairline bg-surface-1 px-4 py-3 shadow-[0_-12px_32px_-12px_rgb(0_0_0/0.6)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:px-6"
    >
      {/* Faint ember line along the top edge while music plays */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/70 to-transparent transition-opacity duration-(--duration-slow) ${p.playing ? "opacity-100" : "opacity-0"}`}
      />

      {/* Left: what's playing. The cover opens the full view. */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={expand}
          aria-label="Open now playing"
          className={`group/art relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-2 transition-shadow duration-(--duration-slow) focus-visible:outline-2 focus-visible:outline-primary ${p.playing ? "playing-glow" : "shadow-lift"}`}
        >
          {p.current ? (
            <Artwork track={p.current} className="size-full group-hover/art:scale-105" />
          ) : (
            <Disc3 className="m-auto size-6 text-dim" strokeWidth={1.25} />
          )}
          <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity duration-(--duration-fast) group-hover/art:opacity-100">
            <Maximize2 className="size-4" />
          </span>
        </button>
        <div className="min-w-0">
          <p className={`flex items-center gap-2 font-medium ${p.playing ? "text-primary" : ""}`}>
            <span className="truncate">{p.current?.title ?? "Nothing playing"}</span>
            {p.playing && <Meter />}
          </p>
          <p className="truncate text-body text-muted-foreground">
            {p.failed ? "Track unavailable" : (p.current?.artist ?? "Press play for today’s trending")}
          </p>
        </div>
        {p.current && <LikeButton track={p.current} className="hidden sm:grid" />}
      </div>

      {/* Centre: transport + seek */}
      <div className="flex flex-col gap-1 md:order-none">
        <Transport />
        <div className="hidden md:block">
          <Progress />
        </div>
      </div>

      {/* Right: queue, volume, expand */}
      <div className="hidden items-center justify-end gap-1 md:flex">
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-lg"
          popoverTarget={queueId}
          aria-label="Queue"
          style={{ anchorName: anchor } as React.CSSProperties}
        >
          <ListMusic />
        </Button>
        <Volume className="w-36 lg:w-44" />
        <Button variant="ghost" size="icon-sm" className="rounded-lg" onClick={expand} aria-label="Open now playing">
          <Maximize2 />
        </Button>
      </div>

      {/* Mobile: thin progress line across the top of the dock */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-white/5 md:hidden">
        <div className="h-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${p.duration ? (p.time / p.duration) * 100 : 0}%` }} />
      </div>

      <div
        id={queueId}
        popover="auto"
        // inset:auto clears the browser's centred-popover default before anchoring above the button
        style={{ inset: "auto", positionAnchor: anchor, bottom: "anchor(top)", right: "anchor(right)" } as React.CSSProperties}
        className="surface-float m-0 mb-3 max-h-[min(60vh,32rem)] w-96 flex-col gap-1 rounded-2xl p-2 text-foreground open:flex"
      >
        <h3 className="px-2 pt-1 pb-1 text-title font-semibold">Queue</h3>
        <QueueList />
      </div>

      <NowPlayingView dialog={dialog} />
    </section>
  );
}
