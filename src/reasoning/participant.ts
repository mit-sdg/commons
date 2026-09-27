/**
 * The floor's participant worker: it seats and plays the phone for every
 * participant that holds a seat on a run. Each round open to the room is begun
 * under every seat of its run that has not begun it, and the begin asks the
 * reasoner. Once the reasoner's reply stands and the participant's own delay
 * has passed, it answers each box through Responding and hands in, so the
 * model's hand-in lands like anyone else's.
 */

import { participantAnswers } from "../computations/live-walls.ts";

type Awaitable<Value> = Value | PromiseLike<Value>;

interface OpenEdition {
  edition: string;
}

interface Edition {
  whole: string | null;
  open: boolean;
}

interface Snapshot {
  value: unknown;
}

interface Response {
  response: string;
  participant: string;
  submitted: boolean;
  startedAt: Date;
}

interface Reply {
  reply: string;
}

interface Seat {
  user: string;
}

interface Trashed {
  trashed: boolean;
}

export interface ParticipantFloor {
  Publishing: {
    _openEditions(input: Record<string, never>): Awaitable<OpenEdition[]>;
    _edition(input: { edition: string }): Awaitable<Edition[]>;
  };
  Responding: {
    _responsesFor(input: { subject: string }): Awaitable<Response[]>;
    begin(input: { participant: string; subject: string; at: Date }): Awaitable<unknown>;
    answer(input: { response: string; item: string; value: string }): Awaitable<unknown>;
    submit(input: { response: string; at: Date }): Awaitable<unknown>;
  };
  Reasoning: {
    _repliesAbout(input: { about: string }): Awaitable<Reply[]>;
    _pendingAbout(input: { about: string }): Awaitable<unknown[]>;
    _lastFailureAbout(input: { about: string }): Awaitable<unknown[]>;
  };
  Subscribing: {
    _getSubscribers(input: { target: string }): Awaitable<Seat[]>;
  };
  Trashing: {
    _isTrashed(input: { item: string }): Awaitable<Trashed>;
  };
  RunSnapshotting: {
    _snapshot(input: { subject: string }): Awaitable<Snapshot[]>;
  };
}

const SETTLING_MS = 1_000;
const JITTER_SPREAD = 7;

/** One participant's own delay, stable across passes and spread across the room. */
function delayOf(participant: string): number {
  let seed = 0;
  for (const character of participant) seed = (seed * 31 + character.codePointAt(0)!) % 100_003;
  return SETTLING_MS + (seed % JITTER_SPREAD) * 1_000;
}

async function playOne(
  concepts: ParticipantFloor,
  response: Response,
  value: unknown,
  at: Date,
): Promise<boolean> {
  const [reply] = await concepts.Reasoning._repliesAbout({ about: response.response });
  if (reply === undefined) return false;
  if (at.getTime() - new Date(response.startedAt).getTime() < delayOf(response.participant)) {
    return false;
  }
  const answers = participantAnswers({ reply: reply.reply, value });
  if (answers.length === 0) return false;
  for (const answer of answers) {
    await concepts.Responding.answer({
      response: response.response,
      item: answer.item,
      value: answer.value,
    });
  }
  await concepts.Responding.submit({ response: response.response, at });
  return true;
}

/**
 * The run an open edition is answered under: a round's is its whole while that
 * whole is open, and an edition that is no part is its own run.
 */
async function runOf(concepts: ParticipantFloor, edition: string): Promise<string | undefined> {
  const [released] = await concepts.Publishing._edition({ edition });
  if (released === undefined) return undefined;
  if (released.whole === null) return edition;
  const [whole] = await concepts.Publishing._edition({ edition: released.whole });
  return whole?.open === true ? released.whole : undefined;
}

/** Whether the reasoner was ever asked about a response, however that ask ended. */
async function wasAsked(concepts: ParticipantFloor, response: string): Promise<boolean> {
  if ((await concepts.Reasoning._pendingAbout({ about: response })).length > 0) return true;
  if ((await concepts.Reasoning._repliesAbout({ about: response })).length > 0) return true;
  return (await concepts.Reasoning._lastFailureAbout({ about: response })).length > 0;
}

/**
 * A seat that has not begun the round is begun, and so is one whose response
 * was never put to the reasoner: beginning again rejoins the response in
 * progress, and the begin asks.
 */
async function seat(
  concepts: ParticipantFloor,
  round: string,
  participant: string,
  response: Response | undefined,
  at: Date,
): Promise<void> {
  if (response !== undefined && (await wasAsked(concepts, response.response))) return;
  const { trashed } = await concepts.Trashing._isTrashed({ item: participant });
  if (trashed) return;
  await concepts.Responding.begin({ participant, subject: round, at });
}

export async function serveParticipantsOnce(
  concepts: ParticipantFloor,
  now: () => Date = () => new Date(),
): Promise<number> {
  const editions = await concepts.Publishing._openEditions({});
  let handedIn = 0;
  for (const { edition } of editions) {
    const [snapshot] = await concepts.RunSnapshotting._snapshot({ subject: edition });
    if (snapshot === undefined) continue;
    const run = await runOf(concepts, edition);
    if (run === undefined) continue;
    const seats = await concepts.Subscribing._getSubscribers({ target: run });
    if (seats.length === 0) continue;
    const responses = new Map(
      (await concepts.Responding._responsesFor({ subject: edition })).map((response) => [
        response.participant,
        response,
      ]),
    );
    for (const { user } of seats) {
      const response = responses.get(user);
      if (response?.submitted === true) continue;
      if (run !== edition) {
        try {
          await seat(concepts, edition, user, response, now());
        } catch {
          console.error("participants: one seat could not be begun.");
        }
      }
      if (response === undefined) continue;
      try {
        if (await playOne(concepts, response, snapshot.value, now())) handedIn += 1;
      } catch {
        console.error("participants: one model response could not be handed in.");
      }
    }
  }
  return handedIn;
}

export function startParticipantWorker(concepts: ParticipantFloor, intervalMs = 1_000) {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running !== undefined) return;
    running = serveParticipantsOnce(concepts)
      .then(() => undefined)
      .catch(() => console.error("participants: could not read the responses in progress."))
      .finally(() => {
        running = undefined;
      });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
