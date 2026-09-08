"use client";

/** How does the editor preview selected earlier work and its generated responses? */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type RelayRound,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { api, isApiError, type Output, publicErrorMessage } from "@/lib/api";

/** What the editor reads about a leg: the sample, an ask still out, a failure. */
export type SampleRead = Output<"/live/rounds/sample">;
export type Sample = NonNullable<SampleRead["sample"]>;
export type SampleAnswer = Sample["answers"][number];

/** The model was asked and did not answer. */
export const NOT_ANSWERING = "AI did not respond. Try again.";

/** The reply came back with nothing the editor could read as answers. */
export const NOTHING_SAMPLED =
  "Couldn’t generate example responses. Try again.";

/** How often the editor reads again while an ask is out. */
const POLL_MS = 1000;

/** How long a press waits before it stops waiting on the reply. */
const WAIT_MS = 90_000;

/** The piles a sample names, each once, in the order they are first placed in. */
export function sampledPiles(answers: SampleAnswer[]): string[] {
  const names: string[] = [];
  for (const answer of answers) {
    if (!names.includes(answer.pile)) names.push(answer.pile);
  }
  return names;
}

/**
 * The round as the sample was asked about it. The passage reads the kind, the
 * question, the standing piles, and the note to the sorter, so a change to any
 * of them is what the next read answers `stale` about.
 */
export function sampleKey(round: RelayRound | null): string {
  if (round === null) return "";
  return JSON.stringify([
    round.kind,
    round.prompt,
    round.choices,
    round.parts,
    round.cap,
    round.takes,
    round.piles,
    round.notes,
  ]);
}

export function stale(sample: Sample | null): boolean {
  return sample?.standing === "stale";
}

/** Whether a failure about the leg is newer than the sample it would replace. */
export function unanswered(read: SampleRead | null): boolean {
  if (read === null || read.failure === null) return false;
  if (read.sample === null) return true;
  return after(read.failedAt, read.sample.answeredAt);
}

/** Whether one moment stands after another, with a missing moment the oldest. */
function after(later: string | null, earlier: string | null): boolean {
  if (later === null) return false;
  if (earlier === null) return true;
  return Date.parse(later) > Date.parse(earlier);
}

/** What a read of a leg holds, in one string, to tell one read from the next. */
export function readMark(read: SampleRead | null): string {
  if (read === null) return "";
  return `${read.sample?.asking ?? ""}|${read.sample?.answeredAt ?? ""}|${read.failedAt ?? ""}`;
}

/**
 * The sample as the wall would hold it: one card per answer, one pile per name
 * it places into. The sample has no ids of its own, so the wall is given
 * standing ones, and the wall stands closed — this is the face a phone meets
 * after hand-in, not a round anybody is sorting.
 */
export function sampleWall(
  round: RelayRound,
  answers: SampleAnswer[],
): WallShape {
  const names = sampledPiles(answers);
  const ids = new Map(
    names.map((name, index) => [name, `sample-pile-${index + 1}`]),
  );
  return {
    round: `sample-${round.leg}`,
    number: round.number,
    title: round.title,
    open: false,
    openedAt: "",
    closedAt: "",
    begun: answers.length,
    handedIn: answers.length,
    begunByModel: 0,
    handedInByModel: 0,
    failure: null,
    failedAt: null,
    notes: "",
    asksOut: 0,
    sortPending: false,
    questions: [],
    cards: answers.map((answer, index) => ({
      card: `sample-${index + 1}`,
      value: answer.value,
      pile: ids.get(answer.pile) ?? null,
      mine: false,
      model: false,
      part: "",
    })),
    piles: names.map((name) => ({
      pile: ids.get(name) ?? name,
      name,
      description: "",
      definition: "",
      legacyText: "",
      count: answers.filter((answer) => answer.pile === name).length,
      picked: null,
    })),
  };
}

export function sampleSources(
  round: RelayRound,
  rounds: RelayRound[],
): string[] {
  const visited = new Set<string>([round.leg]);
  const sources: string[] = [];
  function visit(entry: RelayRound) {
    for (const take of entry.takes) {
      if (visited.has(take.source)) continue;
      visited.add(take.source);
      const source = rounds.find((candidate) => candidate.leg === take.source);
      if (source === undefined) continue;
      visit(source);
      sources.push(source.leg);
    }
  }
  visit(round);
  return sources;
}

export interface SampleGroup {
  name: string;
  cards: string[];
}

export function sampleReadKeys(
  round: RelayRound,
  rounds: RelayRound[],
  picks: Readonly<Record<string, string[]>>,
  marks: ReadonlyMap<string, string>,
): { configuration: string; source: string; result: string } {
  const sources = sampleSources(round, rounds);
  const sourceConfiguration = sources.map((source) => [
    source,
    sampleKey(rounds.find((entry) => entry.leg === source) ?? null),
    picks[source],
  ]);
  const source = JSON.stringify([
    sourceConfiguration,
    sources.map((identity) => marks.get(identity) ?? ""),
  ]);
  return {
    configuration: JSON.stringify([sampleKey(round), sourceConfiguration]),
    source,
    result: JSON.stringify([sampleKey(round), source]),
  };
}

export interface Sampling {
  sample: Sample | null;
  groups: SampleGroup[];
  available: string[];
  selected: string[];
  sourceStanding: string;
  asking: boolean;
  line: string | null;
  pick: (names: string[]) => void;
  ask: () => Promise<boolean>;
}

export function useSample(round: RelayRound, rounds: RelayRound[]): Sampling {
  const [, redraw] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    key: string;
    text: string | null;
  } | null>(null);
  const press = useRef(0);
  const alive = useRef(true);
  const leg = round.leg;
  const from = round.takes[0]?.source ?? null;
  const picksText = JSON.stringify(
    Object.fromEntries(
      rounds
        .filter((entry) => assumed.has(entry.leg))
        .map((entry) => [entry.leg, assumed.get(entry.leg)]),
    ),
  );
  const selection = JSON.parse(picksText) as Record<string, string[]>;
  const marks = new Map(
    [...held].map(([identity, value]) => [identity, readMark(value)]),
  );
  const keys = sampleReadKeys(round, rounds, selection, marks);
  const key = keys.configuration;
  const sourceKey = keys.source;
  const configuration = useRef(key);
  const ancestorMarks = JSON.stringify(
    sampleSources(round, rounds).map((source) => readMark(readOf(source))),
  );
  const generationOwner = useRef<symbol | null>(null);
  const line = notice?.key === key ? notice.text : null;
  const setLine = useCallback(
    (text: string | null) => setNotice({ key, text }),
    [key],
  );
  const invalidate = useCallback(() => {
    press.current++;
  }, []);

  useEffect(() => {
    alive.current = true;
    const watcher = () => redraw((beat) => beat + 1);
    watching.add(watcher);
    return () => {
      alive.current = false;
      invalidate();
      watching.delete(watcher);
    };
  }, [invalidate]);

  useEffect(() => {
    if (configuration.current === key) return;
    configuration.current = key;
    invalidate();
  }, [key, invalidate]);

  const readLeg = useCallback(
    async (which: string): Promise<SampleRead | null> => {
      const entry = rounds.find((candidate) => candidate.leg === which);
      if (entry === undefined) return null;
      const requestKeys = sampleReadKeys(
        entry,
        rounds,
        JSON.parse(picksText),
        new Map(
          [...held].map(([identity, value]) => [identity, readMark(value)]),
        ),
      );
      const ticket = (reading.get(which) ?? 0) + 1;
      reading.set(which, ticket);
      const result = await api["/live/rounds/sample"]({
        leg: which,
        picks: JSON.parse(picksText),
      });
      if (isApiError(result)) return null;
      if (reading.get(which) === ticket) {
        held.set(which, result);
        readKeys.set(which, requestKeys.result);
        sourceKeys.set(which, requestKeys.source);
        for (const watcher of watching) watcher();
      }
      return result;
    },
    [picksText, rounds],
  );

  useEffect(() => {
    void readLeg(leg);
  }, [readLeg, leg, ancestorMarks]);

  const waitFor = useCallback(
    async (
      which: string,
      mark: string,
      ticket: number,
    ): Promise<SampleRead | null> => {
      const started = Date.now();
      while (Date.now() - started < WAIT_MS) {
        await sleep(POLL_MS);
        if (press.current !== ticket || !alive.current) return null;
        const landed = await readLeg(which);
        if (press.current !== ticket || !alive.current) return null;
        if (landed !== null && settled(landed, mark)) return landed;
      }
      setLine(NOT_ANSWERING);
      return null;
    },
    [readLeg, setLine],
  );

  const askLeg = useCallback(
    async (which: string, ticket: number): Promise<SampleRead | null> => {
      const before = await readLeg(which);
      if (press.current !== ticket || !alive.current) return null;
      const number = rounds.find((entry) => entry.leg === which)?.number;
      const progress = `Generating round ${number ?? ""}…`;
      setLine(progress);
      if (generation?.owner === generationOwner.current) {
        generation.line = progress;
        for (const watcher of watching) watcher();
      }
      const result = await api["/live/rounds/sample-answers"]({
        leg: which,
        picks: JSON.parse(picksText),
      });
      if (press.current !== ticket || !alive.current) return null;
      if (isApiError(result)) {
        setLine(publicErrorMessage(result.error));
        return null;
      }
      return waitFor(which, readMark(before), ticket);
    },
    [readLeg, rounds, picksText, waitFor, setLine],
  );

  const ask = useCallback(async () => {
    if (busy || generation !== null) return false;
    const owner = Symbol("preview generation");
    generationOwner.current = owner;
    generation = { owner, line: null };
    for (const watcher of watching) watcher();
    const ticket = ++press.current;
    setBusy(true);
    setLine(null);
    try {
      for (const source of sampleSources(round, rounds)) {
        let carried = await readLeg(source);
        if (press.current !== ticket || !alive.current) return false;
        if (
          carried?.sample == null ||
          stale(carried.sample) ||
          carried.sample.answers.length === 0 ||
          unanswered(carried)
        )
          carried = await askLeg(source, ticket);
        if (press.current !== ticket || !alive.current) return false;
        if (
          carried?.sample == null ||
          unanswered(carried) ||
          stale(carried.sample) ||
          carried.sample.answers.length === 0
        ) {
          setLine(
            carried?.sample?.answers.length === 0
              ? NOTHING_SAMPLED
              : NOT_ANSWERING,
          );
          return false;
        }
      }
      const landed = await askLeg(leg, ticket);
      if (press.current !== ticket || !alive.current) return false;
      if (landed?.sample == null || unanswered(landed)) {
        setLine(NOT_ANSWERING);
        return false;
      }
      if (stale(landed.sample) || landed.sample.answers.length === 0) {
        setLine(
          stale(landed.sample)
            ? "Preview changed—refresh to see current results."
            : NOTHING_SAMPLED,
        );
        return false;
      }
      setLine(null);
      return true;
    } finally {
      if (generation?.owner === owner) {
        generation = null;
        generationOwner.current = null;
        for (const watcher of watching) watcher();
      }
      if (alive.current) setBusy(false);
    }
  }, [busy, round, rounds, leg, readLeg, askLeg, setLine]);

  const own = readOf(leg);
  useEffect(() => {
    if (busy || !own?.pending) return;
    const timer = setTimeout(() => void readLeg(leg), POLL_MS);
    return () => clearTimeout(timer);
  }, [busy, own, leg, readLeg]);

  const preview = own?.preview;
  const available = preview?.available ?? [];
  const groups =
    sourceKeys.get(leg) === sourceKey ? (preview?.groups ?? []) : [];
  const sample =
    own?.sample == null
      ? null
      : readKeys.get(leg) === keys.result
        ? own.sample
        : { ...own.sample, standing: "stale" };
  return {
    sample,
    groups,
    available,
    selected:
      from === null
        ? []
        : (assumed.get(from)?.filter((name) => available.includes(name)) ??
          groups.map((group) => group.name)),
    sourceStanding:
      from === null
        ? "none"
        : sourceKeys.get(leg) === sourceKey
          ? (preview?.sourceStanding ?? "missing")
          : "stale",
    asking: busy || generation !== null || own?.pending === true,
    line: generation?.line ?? line ?? (unanswered(own) ? NOT_ANSWERING : null),
    pick: (names) => {
      if (from === null) return;
      assumed.set(from, names);
      for (const watcher of watching) watcher();
    },
    ask,
  };
}

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

/**
 * What each leg was last read as, and who is watching. The column and the
 * drawer are two phones on one page and a round is read by both, so a reply
 * one of them asked for lands on the other as well.
 */
const held = new Map<string, SampleRead>();
const assumed = new Map<string, string[]>();
const readKeys = new Map<string, string>();
const sourceKeys = new Map<string, string>();
const reading = new Map<string, number>();
const watching = new Set<() => void>();
let generation: { owner: symbol; line: string | null } | null = null;

function readOf(leg: string): SampleRead | null {
  return held.get(leg) ?? null;
}

/**
 * Whether a read taken after an ask has something the read behind the ask did
 * not: the reply it waits on, or a failure instead. A read from before the ask
 * registered holds the same mark, which is what keeps the press waiting.
 */
export function settled(read: SampleRead | null, mark: string): boolean {
  return read !== null && !read.pending && readMark(read) !== mark;
}
