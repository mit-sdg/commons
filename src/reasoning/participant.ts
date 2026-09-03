/**
 * The floor's participant worker: it plays the phone for every response begun
 * under a participant that holds a seat on the round's run. Once the reasoner's
 * reply stands and the participant's own delay has passed, it answers each box
 * through Responding and hands in, so the model's cards land in the tray like
 * anyone else's.
 */

import { participantAnswers } from "../computations/live-walls.ts";

type Awaitable<Value> = Value | PromiseLike<Value>;

interface OpenEdition {
  edition: string;
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

interface Link {
  target: string;
}

interface Seated {
  subscribed: boolean;
}

export interface ParticipantFloor {
  Publishing: {
    _openEditions(input: Record<string, never>): Awaitable<OpenEdition[]>;
  };
  Responding: {
    _responsesFor(input: { subject: string }): Awaitable<Response[]>;
    answer(input: { response: string; item: string; value: string }): Awaitable<unknown>;
    submit(input: { response: string; at: Date }): Awaitable<unknown>;
  };
  Reasoning: {
    _repliesAbout(input: { about: string }): Awaitable<Reply[]>;
  };
  Linking: {
    _getLinks(input: { source: string }): Awaitable<Link[]>;
  };
  Subscribing: {
    _isSubscribed(input: { user: string; target: string }): Awaitable<Seated>;
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

export async function serveParticipantsOnce(
  concepts: ParticipantFloor,
  now: () => Date = () => new Date(),
): Promise<number> {
  const editions = await concepts.Publishing._openEditions({});
  let handedIn = 0;
  for (const { edition } of editions) {
    // A round's edition is linked to its run; a quiz or survey run is linked to nothing.
    const [link] = await concepts.Linking._getLinks({ source: edition });
    if (link === undefined) continue;
    const [snapshot] = await concepts.RunSnapshotting._snapshot({ subject: edition });
    if (snapshot === undefined) continue;
    const responses = await concepts.Responding._responsesFor({ subject: edition });
    for (const response of responses) {
      if (response.submitted) continue;
      const { subscribed } = await concepts.Subscribing._isSubscribed({
        user: response.participant,
        target: link.target,
      });
      if (!subscribed) continue;
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
