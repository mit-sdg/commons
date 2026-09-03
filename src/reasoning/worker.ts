import type { ReasonerConfiguration } from "./configuration.ts";
import { scriptedEditsReply } from "./scripted-edits.ts";
import { scriptedWallReply } from "./scripted-walls.ts";

type Awaitable<Value> = Value | PromiseLike<Value>;

interface PendingAsking {
  asking: string;
  reasoner: string;
  passage: string;
}

export interface ReasonerOutbox {
  _pending(input: Record<string, never>): Awaitable<PendingAsking[]>;
  answer(input: { asking: string; reply: string; at: Date }): Awaitable<unknown>;
  fail(input: { asking: string; account: string; at: Date }): Awaitable<unknown>;
}

/** A mind takes one passage and returns the reasoner's whole reply text. */
export type Mind = (ask: { reasoner: string; passage: string }) => Promise<string>;

const TRANSPORT_TRIES = 3;
const TRY_TIMEOUT_MS = 45_000;

/** Keep the failure account short and free of the transport's stack trace. */
function failureAccount(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The reasoner transport rejected the ask.";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 299)}…` : collapsed;
}

export function geminiMind(configuration: ReasonerConfiguration): Mind {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${configuration.model}:generateContent`;
  return async ({ passage }) => {
    let lastError: unknown;
    for (let attempt = 1; attempt <= TRANSPORT_TRIES; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "x-goog-api-key": configuration.apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: passage }] }],
            // thinkingBudget 0 halves median latency with no measured validity
            // cost; the reply's worth is guarded by the parse partition anyway.
            generationConfig: {
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: AbortSignal.timeout(TRY_TIMEOUT_MS),
        });
        if (!response.ok) {
          throw new Error(`The reasoner answered HTTP ${response.status}.`);
        }
        const body = (await response.json()) as {
          candidates?: {
            finishReason?: string;
            content?: { parts?: { text?: string }[] };
          }[];
        };
        const candidate = body.candidates?.[0];
        const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? "").join("");
        if (candidate === undefined || text === "") {
          throw new Error("The reasoner returned no text.");
        }
        return text;
      } catch (error) {
        lastError = error;
        if (attempt < TRANSPORT_TRIES) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
    }
    throw lastError ?? new Error("The reasoner could not be reached.");
  };
}

/**
 * The deterministic mind for tests and keyless demos. It reads the same
 * passages the real mind receives and keys its replies off markers the
 * drafting passages and test requests place there.
 */
export function scriptedMind(): Mind {
  return ({ passage }) => {
    const roundReply = scriptedWallReply(passage) ?? scriptedEditsReply(passage);
    if (roundReply !== undefined) return Promise.resolve(roundReply);
    // Markers are read from the author's own words — the correction, the
    // clarification answer, or the request — never from the contract text or
    // prior material that precedes them: those mention every form.
    const authorText = (marker: string, next: string[]) => {
      const text = passage.split(marker)[1];
      if (text === undefined) return undefined;
      const boundary = next
        .map((candidate) => text.indexOf(candidate))
        .filter((index) => index >= 0)
        .sort((left, right) => left - right)[0];
      return boundary === undefined ? text : text.slice(0, boundary);
    };
    const request =
      authorText("The correction:\n", ['\n\nKeep "form":']) ??
      authorText("The author answered:\n", ["\n\nDeliver the draft;"]) ??
      authorText("The request:\n", [
        "\n\nYou asked this clarifying question:",
        "\n\nYour previous reply came back unusable.",
      ]) ??
      passage;
    const correcting = passage.includes("An earlier draft exists, as this ");
    const reply = (() => {
      if (passage.includes("Your previous reply came back unusable")) {
        return JSON.stringify(scriptedQuiz("Repaired quiz"));
      }
      if (passage.includes("You asked this clarifying question:")) {
        return JSON.stringify(scriptedQuiz("Clarified quiz"));
      }
      if (request.includes("unreadable")) {
        return "this reply is not JSON at all";
      }
      if (request.includes("ambiguous")) {
        return JSON.stringify({
          kind: "question",
          question: "Should this be a quiz or a survey?",
        });
      }
      if (request.includes("survey")) {
        return JSON.stringify(scriptedSurvey(correcting ? "Corrected survey" : "Scripted survey"));
      }
      if (request.includes("quiz")) {
        return JSON.stringify(scriptedQuiz(correcting ? "Corrected quiz" : "Scripted quiz"));
      }
      if (correcting && passage.includes("An earlier draft exists, as this survey")) {
        return JSON.stringify(scriptedSurvey("Corrected survey"));
      }
      if (correcting) {
        return JSON.stringify(scriptedQuiz("Corrected quiz"));
      }
      return JSON.stringify(scriptedQuiz("Scripted quiz"));
    })();
    return Promise.resolve(reply);
  };
}

function scriptedSurvey(marker: string) {
  return {
    kind: "draft",
    form: "survey",
    material: [
      {
        prompt: `${marker}: how is the pace so far?`,
        choices: ["Too slow", "Right", "Too fast"],
        expected: "",
        explanation: "",
      },
      { prompt: `${marker}: what is still unclear?`, choices: [], expected: "", explanation: "" },
    ],
  };
}

function scriptedQuiz(marker: string) {
  return {
    kind: "draft",
    form: "quiz",
    material: [
      {
        prompt: `${marker}: which gas do plants take in?`,
        choices: ["Oxygen", "Carbon dioxide", "Nitrogen"],
        expected: "Carbon dioxide",
        explanation: "Photosynthesis fixes carbon from CO2.",
      },
      {
        prompt: `${marker}: name the pigment that captures light.`,
        choices: [],
        expected: "Chlorophyll",
        explanation: "",
      },
    ],
  };
}

export async function serveOnePass(outbox: ReasonerOutbox, mind: Mind): Promise<number> {
  const pending = await outbox._pending({});
  let served = 0;
  for (const ask of pending) {
    try {
      const reply = await mind({ reasoner: ask.reasoner, passage: ask.passage });
      await outbox.answer({ asking: ask.asking, reply, at: new Date() });
      served += 1;
    } catch (error) {
      console.error("reasoner: an ask failed; recording the failure.");
      try {
        await outbox.fail({
          asking: ask.asking,
          account: failureAccount(error),
          at: new Date(),
        });
      } catch {
        console.error("reasoner: could not record the failure.");
      }
    }
  }
  return served;
}

export function startReasonerWorker(
  outbox: ReasonerOutbox,
  configuration: ReasonerConfiguration,
  mind: Mind = configuration.mode === "scripted" ? scriptedMind() : geminiMind(configuration),
  intervalMs = 500,
) {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running !== undefined) return;
    running = serveOnePass(outbox, mind)
      .then(() => undefined)
      .catch(() => console.error("reasoner: could not read the pending asks."))
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
