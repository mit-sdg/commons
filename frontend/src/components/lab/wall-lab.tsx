"use client";

import { useSearchParams } from "next/navigation";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { frameAt, polled, type Trace, trickled } from "@/components/lab/replay";
import recorded from "@/components/lab/trace-50.json";
import { JoinCode } from "@/components/live/qr-code";
import type { Wall as WallShape } from "@/components/live/rounds";
import { Wall } from "@/components/live/wall";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The wall lab: the real wall, on every surface it has, fed a recorded run
 * the way a screen polling the server would receive it. Play, pause, step,
 * scrub, and speed are the lab's; the wall's own motion is untouched, so what
 * is seen here is what a room sees. Nothing here reaches a server.
 */

type Surface = "dashboard" | "projector" | "phone";
type Mode = "trace" | "trickle";

const SURFACES: Surface[] = ["dashboard", "projector", "phone"];
const MODES: Mode[] = ["trace", "trickle"];
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const POLLS_MS = [1_000, 3_000];
const GAPS_MS = [500, 1_000, 2_000];
/** How often the lab's clock advances; the readout follows it. */
const TICK_MS = 50;
/** The address the projector's code would carry; no phone joins the lab. */
const JOIN_URL = "https://commons.example/q/lab";
/** How long the clock runs on past the last poll, so the last wave lands. */
const TAIL_MS = 15_000;

const TRACE = recorded as unknown as Trace<WallShape>;

function oneOf<Value extends string | number>(
  choices: readonly Value[],
  raw: string | null,
  fallback: Value,
): Value {
  if (raw === null) return fallback;
  const value = typeof fallback === "number" ? Number(raw) : raw;
  return choices.includes(value as Value) ? (value as Value) : fallback;
}

export function WallLab() {
  const params = useSearchParams();
  const [trace, setTrace] = useState(TRACE);
  const [surface, setSurface] = useState<Surface>(() =>
    oneOf(SURFACES, params.get("surface"), "projector"),
  );
  const [mode, setMode] = useState<Mode>(() =>
    oneOf(MODES, params.get("mode"), "trace"),
  );
  const [speed, setSpeed] = useState(() =>
    oneOf(SPEEDS, params.get("speed"), 1),
  );
  const [pollMs, setPollMs] = useState(() =>
    oneOf(POLLS_MS, params.get("poll"), 3_000),
  );
  const [gapMs, setGapMs] = useState(() =>
    oneOf(GAPS_MS, params.get("gap"), 1_000),
  );

  const frames = useMemo(
    () =>
      mode === "trace"
        ? polled(trace.snaps, pollMs)
        : trickled(trace.snaps, gapMs),
    [trace, mode, pollMs, gapMs],
  );
  const end = (frames[frames.length - 1]?.t ?? 0) + TAIL_MS;

  const [t, setT] = useState(() => Number(params.get("t") ?? 0) || 0);
  const [playing, setPlaying] = useState(() => params.has("play"));
  // A jump in time repaints the wall at once instead of playing every move
  // between; only what plays from there is motion.
  const [jump, setJump] = useState(0);
  const clock = useRef(t);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      clock.current = Math.min(end, clock.current + TICK_MS * speed);
      setT(clock.current);
      if (clock.current >= end) setPlaying(false);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, speed, end]);

  function seek(to: number) {
    clock.current = to;
    setT(to);
    setJump((count) => count + 1);
  }

  const index = frameAt(frames, t);
  const frame = frames[index] ?? null;
  const next = frames[index + 1] ?? null;

  function step() {
    if (next === null) return;
    clock.current = next.t;
    setT(next.t);
  }

  function load(file: File | undefined) {
    if (file === undefined) return;
    void file.text().then((text) => {
      const parsed = JSON.parse(text) as Trace<WallShape>;
      if (!Array.isArray(parsed.snaps)) return;
      setTrace(parsed);
      seek(0);
      setPlaying(false);
    });
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 border-border border-b px-4 py-2 text-sm">
        <span className="font-display font-semibold">Wall lab</span>
        <Choice
          label="Surface"
          value={surface}
          choices={SURFACES}
          onChange={(value) => {
            setSurface(value);
            seek(t);
          }}
        />
        <Choice
          label="Mode"
          value={mode}
          choices={MODES}
          onChange={(value) => {
            setMode(value);
            seek(0);
          }}
        />
        {mode === "trace" ? (
          <Choice
            label="Poll"
            value={pollMs}
            choices={POLLS_MS}
            word={(value) => `${value / 1000} s`}
            onChange={(value) => {
              setPollMs(value);
              seek(0);
            }}
          />
        ) : (
          <Choice
            label="Gap"
            value={gapMs}
            choices={GAPS_MS}
            word={(value) => `${value / 1000} s`}
            onChange={(value) => {
              setGapMs(value);
              seek(0);
            }}
          />
        )}
        <Choice
          label="Speed"
          value={speed}
          choices={SPEEDS}
          word={(value) => `${value}×`}
          onChange={setSpeed}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setPlaying((on) => !on)}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={next === null}
          onClick={step}
        >
          Step
        </Button>
        <input
          type="range"
          aria-label="Time"
          min={0}
          max={end}
          step={100}
          value={t}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-[12rem] flex-1 accent-primary"
        />
        <span
          data-lab-time={Math.round(t)}
          data-lab-frame={index}
          className="font-mono text-muted-foreground tabular-nums"
        >
          {(t / 1000).toFixed(1)} s · poll {index + 1} of {frames.length}
        </span>
        <label className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline">
          Load a trace
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => load(event.target.files?.[0])}
          />
        </label>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          surface === "projector" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {frame === null ? null : (
          <Stage surface={surface} wall={frame.wall} jump={jump} />
        )}
      </div>
    </div>
  );
}

function Choice<Value extends string | number>({
  label,
  value,
  choices,
  word = String,
  onChange,
}: {
  label: string;
  value: Value;
  choices: readonly Value[];
  word?: (value: Value) => string;
  onChange: (value: Value) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-muted-foreground">
      {label}
      <select
        value={String(value)}
        onChange={(event) => {
          const picked = choices.find(
            (choice) => String(choice) === event.target.value,
          );
          if (picked !== undefined) onChange(picked);
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
      >
        {choices.map((choice) => (
          <option key={String(choice)} value={String(choice)}>
            {word(choice)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The wall on one surface, framed as that surface frames it. Only a new wall
 * or a jump re-renders it, so the lab's clock never disturbs a flight.
 */
const Stage = memo(function Stage({
  surface,
  wall,
  jump,
}: {
  surface: Surface;
  wall: WallShape;
  jump: number;
}) {
  const key = `${surface}-${jump}`;
  if (surface === "projector") {
    const filling = !wall.open || wall.number !== 1 || wall.piles.length > 0;
    return (
      <div className="flex h-full flex-col gap-[clamp(1rem,3dvh,32px)] overflow-hidden px-[clamp(1.5rem,4.5vw,88px)] pt-[clamp(1.25rem,5.5dvh,64px)] pb-[clamp(1rem,4.5dvh,56px)]">
        <Wall
          key={key}
          wall={wall}
          big
          eyebrow="Trace run, fifty seats"
          scroll
          shelfAt="bottom"
          foot={
            filling ? (
              <JoinCode url={JOIN_URL} code="LAB" size="corner" />
            ) : undefined
          }
          empty={
            filling ? undefined : (
              <JoinCode url={JOIN_URL} code="LAB" size="room" />
            )
          }
          className="min-h-0 flex-1 overflow-hidden"
        />
      </div>
    );
  }
  if (surface === "phone") {
    return (
      <div className="mx-auto w-[390px] px-4 py-4">
        <Wall key={key} wall={wall} phone />
      </div>
    );
  }
  return (
    <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Wall key={key} wall={wall} named />
      <aside className="hidden lg:block" />
    </div>
  );
});
