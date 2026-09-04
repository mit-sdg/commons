"use client";

import { adopt, apply, diff, type Staged } from "@/components/live/wall-motion";

/**
 * A recorded run, replayed to the wall the way the room's screens would see
 * it: the server held a sequence of walls, each at a time from the round's
 * opening, and a screen polling on its own clock saw whichever wall stood at
 * each poll. The lab plays those polls to the real wall, at any speed, from
 * any moment, so its motion can be judged without a server or a class.
 */

export interface Snap<Wall> {
  /** Milliseconds from the round's opening. */
  t: number;
  wall: Wall;
}

export interface Trace<Wall> {
  seats: number;
  /** How often the model sorted, on the dashboard's tick. */
  tickMs: number;
  snaps: Snap<Wall>[];
}

/** One wall as a screen receives it, at the lab's time. */
export interface Frame<Wall> {
  t: number;
  wall: Wall;
}

/** The last snapshot the server held at time `t`, or none before the first. */
export function snapAt<Wall>(
  snaps: Snap<Wall>[],
  t: number,
): Snap<Wall> | null {
  let found: Snap<Wall> | null = null;
  for (const snap of snaps) {
    if (snap.t > t) break;
    found = snap;
  }
  return found;
}

/**
 * The walls a screen polling every `pollMs` receives: the first snapshot at
 * once, then at each poll the wall the server held, only when it has changed.
 */
export function polled<Wall>(
  snaps: Snap<Wall>[],
  pollMs: number,
): Frame<Wall>[] {
  const first = snaps[0];
  if (first === undefined) return [];
  const last = snaps[snaps.length - 1] ?? first;
  const frames: Frame<Wall>[] = [{ t: 0, wall: first.wall }];
  let shown: Snap<Wall> = first;
  for (let at = pollMs; at <= last.t + pollMs; at += pollMs) {
    const held = snapAt(snaps, at);
    if (held === null || held === shown) continue;
    frames.push({ t: at, wall: held.wall });
    shown = held;
  }
  return frames;
}

/**
 * The same run as a hand would have sorted it: every change between two
 * snapshots as its own wall, one move each, a gap apart. A dashboard polled
 * while one person sorts sees the wall this way, one card at a time.
 */
export function trickled<Wall extends Staged>(
  snaps: Snap<Wall>[],
  gapMs: number,
): Frame<Wall>[] {
  const first = snaps[0];
  if (first === undefined) return [];
  const frames: Frame<Wall>[] = [{ t: 0, wall: first.wall }];
  let shown = first.wall;
  let at = 0;
  for (const snap of snaps.slice(1)) {
    for (const move of diff(shown, snap.wall)) {
      at += gapMs;
      shown = apply(shown, snap.wall, move);
      frames.push({ t: at, wall: shown });
    }
    // A pile's name or lid changes with no card moving; the last poll brings it.
    shown = adopt(shown, snap.wall);
    const lastFrame = frames[frames.length - 1];
    if (lastFrame !== undefined) lastFrame.wall = shown;
  }
  return frames;
}

/** The index of the frame a screen shows at time `t`: the last one delivered. */
export function frameAt<Wall>(frames: Frame<Wall>[], t: number): number {
  let index = -1;
  for (const [position, frame] of frames.entries()) {
    if (frame.t > t) break;
    index = position;
  }
  return index;
}
