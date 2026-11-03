"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { getAnalyser } from "@/lib/audio";

const BARS = 28;

// Frequency bars drawn from the shared analyser; animates only while `active`.
export function Visualizer({ active, className = "" }: { active: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current!;
    const g = el.getContext("2d")!;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = getComputedStyle(el).color;
    let frame = 0;
    let levels = new Array<number>(BARS).fill(0);

    const draw = () => {
      const dpr = devicePixelRatio || 1;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return; // hidden tab (display:none); the ResizeObserver redraws once shown
      // Rounded: canvas sizes are integers, so fractional DPRs (e.g. 1.25) would otherwise reallocate every frame
      const [cw, ch] = [Math.round(w * dpr), Math.round(h * dpr)];
      if (el.width !== cw || el.height !== ch) [el.width, el.height] = [cw, ch];
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const analyser = getAnalyser();
      if (active && analyser) {
        const bins = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(bins);
        // Skip the top quarter of bins: little musical energy up there, bars would sit flat.
        const usable = Math.floor(bins.length * 0.75);
        levels = levels.map((_, i) => bins[Math.floor((i / BARS) * usable)] / 255);
      } else {
        levels = levels.map((v) => v * 0.85); // ease down when paused
      }

      const gap = 3;
      const bw = (w - gap * (BARS - 1)) / BARS;
      g.fillStyle = color;
      levels.forEach((v, i) => {
        const bh = Math.max(2, v * h);
        g.globalAlpha = 0.35 + v * 0.65;
        g.beginPath();
        g.roundRect(i * (bw + gap), h - bh, bw, bh, Math.min(bw, bh) / 2);
        g.fill();
      });

      if (!reduceMotion && (active || levels.some((v) => v > 0.01))) frame = requestAnimationFrame(draw);
    };
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      draw();
    });
    resize.observe(el); // also fires once on observe, which does the first draw
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [active]);

  return <canvas ref={canvas} aria-hidden className={`block w-full text-primary ${className}`} />;
}

/** Three bouncing bars: marks the track or station that is audibly playing. */
export function Meter() {
  return (
    <span aria-hidden className="inline-flex h-3 items-end gap-[2px]">
      {[0, 0.25, 0.5].map((d) => (
        <span key={d} className="h-full w-[3px] origin-bottom animate-meter rounded-full bg-primary" style={{ animationDelay: `-${d}s` }} />
      ))}
    </span>
  );
}

/** Play/pause glyph that swaps with a quick scale-and-fade instead of a hard cut. */
export function PlayGlyph({ playing }: { playing: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={playing ? "pause" : "play"}
        initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="grid place-items-center"
      >
        {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="translate-x-px" />}
      </motion.span>
    </AnimatePresence>
  );
}
