"use client";

/**
 * The sample: one ask about the round the phone shows, and what comes back —
 * a dozen answers, each written the way a participant writes and placed in a
 * pile. Nothing is kept here: the ask is about the leg and the reply is
 * Reasoning's own record, so a reload reads the same sample back.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { refusalSentence } from "@/components/live/refusals";
import {
  kindOf,
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

/** A sample the round has moved out from under keeps its accent, dimmed. */
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
  return `${read.sample?.answeredAt ?? ""}|${read.failedAt ?? ""}`;
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
      count: answers.filter((answer) => answer.pile === name).length,
      picked: null,
    })),
  };
}

/** Resolve preview dependencies oldest first; malformed cycles stop locally. */
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

/** Examples preserve written responses through a vote, instead of showing votes as source text. */
export function sampledGroups(
  round: RelayRound,
  rounds: RelayRound[],
  samples: ReadonlyMap<string, Sample | null>,
  visited = new Set<string>(),
): SampleGroup[] {
  if (visited.has(round.leg)) return [];
  visited.add(round.leg);
  const answers = samples.get(round.leg)?.answers ?? [];
  if (kindOf(round) === "vote") {
    const take = round.takes.find((entry) => entry.use === "choices");
    const source = rounds.find((entry) => entry.leg === take?.source);
    if (source) return sampledGroups(source, rounds, samples, visited);
    return round.choices.map((name) => ({ name, cards: [] }));
  }
  const names = [
    ...new Set([
      ...round.piles.map((pile) => pile.name),
      ...sampledPiles(answers),
    ]),
  ];
  return names.map((name) => ({
    name,
    cards: answers
      .filter((answer) => answer.pile === name)
      .map((answer) => answer.value),
  }));
}

export interface Sampling {
  /** The round's own sample, when a reply about its leg stands. */
  sample: Sample | null;
  /** The piles the source's sample named, which stand where the class's would. */
  names: string[];
  groups: SampleGroup[];
  /** An ask is out: the button says so and is out with it. */
  asking: boolean;
  /** Whether the ask is offered at all — a retired relay's round is not. */
  offered: boolean;
  /** The accent dims where what is shown is behind the round as it stands now. */
  dim: boolean;
  /** What stands beside the button when something has to be said. */
  line: string | null;
  ask: () => void;
}

/**
 * One round's sample: read on mount and after every edit, asked for on a
 * press. A round that takes from an earlier one is sampled after its source,
 * so a press with no source sample asks the source first and asks the round
 * once the source's reply lands — one press, and the button is out for both.
 */
export function useSample(round: RelayRound, rounds: RelayRound[]): Sampling {
  const leg = round.leg;
  const from = round.takes[0]?.source ?? null;
  const key = sampleKey(round);
  const ancestors = JSON.stringify(
    sampleSources(round, rounds).map((source) => [
      source,
      sampleKey(rounds.find((entry) => entry.leg === source) ?? null),
    ]),
  );
  /** A read landing anywhere on the page redraws every phone standing on it. */
  const [, redraw] = useState(0);
  /** A press is out, from the press itself until the reply it waits on lands. */
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [retired, setRetired] = useState(false);
  /** Which press is the live one: an older one drops whatever it comes back with. */
  const press = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const watcher = () => redraw((beat) => beat + 1);
    watching.add(watcher);
    return () => {
      alive.current = false;
      watching.delete(watcher);
    };
  }, []);

  const readLeg = useCallback(
    async (which: string): Promise<SampleRead | null> => {
      const result = await api["/live/rounds/sample"]({ leg: which });
      if (isApiError(result)) return null;
      keep(which, result);
      return result;
    },
    [],
  );

  // The sample is durable through Reasoning's own record: what the leg was
  // told last stands after a reload, and after an edit the same read is what
  // says the sample no longer fits the round.
  useEffect(() => {
    void readLeg(leg);
  }, [readLeg, leg, key]);

  useEffect(() => {
    for (const [source] of JSON.parse(ancestors) as [string, string][])
      void readLeg(source);
  }, [readLeg, ancestors]);

  /**
   * A refused ask says which word stands behind the category. The boundary
   * refuses a round whose source has no sample and a round of a retired relay
   * alike, and the source is asked first here, so only a round that takes from
   * one this press did not reach can be the first.
   */
  const refuse = useCallback(
    (which: string, error: string) => {
      if (error !== "CONFLICT") {
        setLine(publicErrorMessage(error));
        return;
      }
      const asked = rounds.find((entry) => entry.leg === which) ?? null;
      const takes = which === leg ? undefined : asked?.takes[0];
      if (takes === undefined) {
        setRetired(true);
        return;
      }
      setLine(
        refusalSentence("SOURCE_UNSAMPLED", { round: takes.sourceNumber }),
      );
    },
    [leg, rounds],
  );

  /** Reads the leg about once a second until the reply this press waits on lands. */
  const waitFor = useCallback(
    async (
      which: string,
      mark: string,
      ticket: number,
    ): Promise<SampleRead | null> => {
      const started = Date.now();
      for (;;) {
        await sleep(POLL_MS);
        if (press.current !== ticket || !alive.current) return null;
        const landed = await readLeg(which);
        if (press.current !== ticket || !alive.current) return null;
        if (landed !== null && settled(landed, mark)) return landed;
        if (Date.now() - started >= WAIT_MS) {
          setLine(NOT_ANSWERING);
          return null;
        }
      }
    },
    [readLeg],
  );

  /**
   * One ask, behind a read of what the leg held before it: that read is what
   * tells the reply this ask waits on from the one it replaces. An ask already
   * out is one this press waits on rather than a second.
   */
  const askLeg = useCallback(
    async (which: string, ticket: number): Promise<SampleRead | null> => {
      const mark = readMark(await readLeg(which));
      const result = await api["/live/rounds/sample-answers"]({ leg: which });
      if (press.current !== ticket) return null;
      if (isApiError(result)) {
        refuse(which, result.error);
        return null;
      }
      return waitFor(which, mark, ticket);
    },
    [readLeg, refuse, waitFor],
  );

  const ask = useCallback(() => {
    if (busy) return;
    const ticket = ++press.current;
    setBusy(true);
    setLine(null);
    void (async () => {
      try {
        for (const source of sampleSources(round, rounds)) {
          let carried = await readLeg(source);
          if (press.current !== ticket || !alive.current) return;
          if (carried?.sample == null || stale(carried.sample)) {
            carried = await askLeg(source, ticket);
          }
          if (press.current !== ticket || !alive.current) return;
          if (
            carried?.sample == null ||
            unanswered(carried) ||
            stale(carried.sample)
          )
            return;
        }
        await askLeg(leg, ticket);
      } finally {
        if (press.current === ticket && alive.current) setBusy(false);
      }
    })();
  }, [busy, round, rounds, leg, readLeg, askLeg]);

  const own = readOf(leg);
  const source = from === null ? null : readOf(from);

  // A reply an earlier session asked for may still be out when the editor
  // opens, so a read that says an ask stands is read again until it settles.
  useEffect(() => {
    if (busy) return;
    const out = [leg, ...(from === null ? [] : [from])].filter(
      (which) => readOf(which)?.pending === true,
    );
    if (out.length === 0) return;
    const timer = setTimeout(() => {
      for (const which of out) void readLeg(which);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [busy, own, source, leg, from, readLeg]);

  const sample = own?.sample ?? null;
  const carried = source?.sample ?? null;
  const said =
    line ??
    (unanswered(own) || unanswered(source)
      ? NOT_ANSWERING
      : sample !== null && sample.answers.length === 0
        ? NOTHING_SAMPLED
        : null);

  const sourceRound = rounds.find((entry) => entry.leg === from);
  const groups =
    sourceRound === undefined
      ? []
      : sampledGroups(
          sourceRound,
          rounds,
          new Map(
            rounds.map((entry) => [
              entry.leg,
              readOf(entry.leg)?.sample ?? null,
            ]),
          ),
        );
  return {
    sample,
    names: groups.map((group) => group.name),
    groups,
    asking: busy,
    offered: !retired,
    dim: stale(sample) || stale(carried),
    line: said,
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
const watching = new Set<() => void>();

function readOf(leg: string): SampleRead | null {
  return held.get(leg) ?? null;
}

function keep(leg: string, standing: SampleRead): void {
  held.set(leg, standing);
  for (const watcher of watching) watcher();
}

/**
 * Whether a read taken after an ask has something the read behind the ask did
 * not: the reply it waits on, or a failure instead. A read from before the ask
 * registered holds the same mark, which is what keeps the press waiting.
 */
export function settled(read: SampleRead | null, mark: string): boolean {
  return read !== null && !read.pending && readMark(read) !== mark;
}
