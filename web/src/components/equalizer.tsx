"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { EQ_BANDS, getEq, setEq, type EqState } from "@/lib/audio";

// dB per band, low to high (32 Hz … 16 kHz)
const PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 0, 1, 3, 5, 6, 7],
  Vocal: [-3, -2, -1, 1, 4, 5, 4, 2, 0, -1],
  Rock: [5, 4, 2, 0, -2, -1, 2, 4, 5, 5],
  Electronic: [6, 5, 1, 0, -2, 1, 0, 2, 5, 6],
  Acoustic: [3, 3, 2, 1, 2, 2, 3, 3, 2, 1],
};

const label = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

export function Equalizer() {
  // Mounted only on the Equalizer tab (client-side), so reading saved settings here is safe.
  const [state, setState] = useState<EqState>(getEq);
  const update = (next: EqState) => {
    setState(next);
    setEq(next);
  };
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].every((g, i) => g === state.gains[i]));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Equalizer</h1>
          <p className="text-sm text-muted-foreground">Shapes both music and radio.</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          {state.enabled ? "On" : "Off"}
          <Switch
            checked={state.enabled}
            onCheckedChange={(enabled) => update({ ...state, enabled })}
            aria-label="Equalizer on"
          />
        </label>
      </header>

      <div className="flex flex-wrap gap-3" role="group" aria-label="Presets">
        {Object.entries(PRESETS).map(([name, gains]) => (
          <button
            key={name}
            onClick={() => update({ enabled: true, gains })}
            aria-pressed={preset === name}
            className={`rounded-full px-4 py-2 text-sm transition-shadow focus-visible:outline-2 focus-visible:outline-primary ${
              preset === name ? "neu-inset text-primary" : "neu hover:text-primary"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <section
        className={`neu-panel flex min-h-0 flex-1 flex-col gap-4 rounded-3xl bg-panel p-6 text-panel-foreground transition-opacity ${
          state.enabled ? "" : "opacity-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{preset ?? "Custom"}</h2>
          <button
            onClick={() => update({ ...state, gains: PRESETS.Flat })}
            className="flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        </div>
        <div className="flex min-h-48 flex-1 justify-between gap-2">
          {EQ_BANDS.map((hz, i) => (
            <div key={hz} className="flex flex-1 flex-col items-center gap-3">
              <span className="font-dot text-sm font-bold tabular-nums">
                {state.gains[i] > 0 ? "+" : ""}
                {state.gains[i]}
              </span>
              <Slider
                orientation="vertical"
                aria-label={`${label(hz)}Hz`}
                min={-12}
                max={12}
                step={1}
                disabled={!state.enabled}
                value={[state.gains[i]]}
                onValueChange={(v) => {
                  const gains = [...state.gains];
                  gains[i] = Array.isArray(v) ? v[0] : v;
                  update({ ...state, gains });
                }}
                className="min-h-0 flex-1"
              />
              <span className="text-xs opacity-60">{label(hz)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs opacity-50">
          <span>-12 dB</span>
          <span>+12 dB</span>
        </div>
      </section>
    </div>
  );
}
