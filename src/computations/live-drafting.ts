/**
 * Passages put before the reasoner by the live drafting loop, and the readings
 * of what it replies. The contract is small on purpose: the reasoner answers in
 * JSON mode, one object per reply, and every reply parses into exactly one of
 * three kinds — a draft, a clarifying question, or neither.
 */

const FORMS = ["quiz", "survey"];

const CONTRACT = `You compose quizzes and surveys for a live classroom tool.
Reply with exactly one JSON object and nothing else.

To deliver a draft:
{"kind":"draft","form":"quiz","material":[{"prompt":"...","choices":["..."],"expected":"...","explanation":"..."}]}
- "form" is "quiz" or "survey".
- Every item needs a "prompt". "choices" may be [] for a written answer.
- A quiz item's "expected" is the correct answer; when choices are given it must equal one of them exactly. "explanation" says briefly why, and may be "".
- A survey proposes no answers: every "expected" and "explanation" is "".
- Unless the request says otherwise, draft 3 to 6 items.

To ask one clarifying question instead:
{"kind":"question","question":"..."}
Ask only when the request could equally be a quiz or a survey and the choice changes what you would write. Never guess the form; otherwise never ask.`;

export function draftTitle({ request }: { request: string }): string {
  const collapsed = request.replace(/\s+/g, " ").trim();
  if (collapsed === "") return "Untitled";
  return collapsed.length > 60 ? `${collapsed.slice(0, 59)}\u2026` : collapsed;
}

export function draftingPassage({ request }: { request: string }): string {
  return `${CONTRACT}\n\nThe request:\n${request}`;
}

export function revisionPassage({
  request,
  form,
  material,
}: {
  request: string;
  form: string;
  material: unknown;
}): string {
  return `${CONTRACT}\n\nAn earlier draft exists, as this ${form}:\n${JSON.stringify(material)}\n\nThe correction:\n${request}\n\nDeliver the whole revised draft, changing only what the correction asks.`;
}

export function clarifiedPassage({
  request,
  question,
  answer,
}: {
  request: string;
  question: string;
  answer: string;
}): string {
  return `${CONTRACT}\n\nThe request:\n${request}\n\nYou asked this clarifying question:\n${question}\n\nThe author answered:\n${answer}\n\nDeliver the draft; do not ask again.`;
}

export function repairPassage({
  request,
  offering,
  account,
}: {
  request: string;
  offering: string;
  account: string;
}): string {
  return `${CONTRACT}\n\nThe request:\n${request}\n\nYour previous reply came back unusable. The reply was:\n${offering}\n\nThe account of the problem:\n${account}\n\nDeliver a correct reply this time.`;
}

type Entry = { prompt: string; choices: string[]; expected: string; explanation: string };
type Reading =
  | { kind: "draft"; form: string; material: Entry[] }
  | { kind: "question"; question: string }
  | { kind: "neither"; reason: string };

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

function parse(reply: string): Reading {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return { kind: "neither", reason: "The reply was not readable JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "neither", reason: "The reply was not a JSON object." };
  }
  const record = parsed as Record<string, unknown>;
  if (record.kind === "question") {
    const question = asString(record.question).trim();
    if (question === "") {
      return { kind: "neither", reason: "The question reply carried no question." };
    }
    return { kind: "question", question };
  }
  if (record.kind === "draft") {
    const form = asString(record.form);
    if (!FORMS.includes(form)) {
      return { kind: "neither", reason: "The draft named no recognizable form." };
    }
    if (!Array.isArray(record.material) || record.material.length === 0) {
      return { kind: "neither", reason: "The draft carried no material." };
    }
    const material: Entry[] = [];
    for (const entry of record.material) {
      if (typeof entry !== "object" || entry === null) {
        return { kind: "neither", reason: "A material entry was not an object." };
      }
      const item = entry as Record<string, unknown>;
      const prompt = asString(item.prompt).trim();
      if (prompt === "") {
        return { kind: "neither", reason: "A material entry carried no prompt." };
      }
      const choices = Array.isArray(item.choices) ? item.choices.map(asString) : [];
      const expected = form === "quiz" ? asString(item.expected) : "";
      if (form === "quiz" && expected === "") {
        return { kind: "neither", reason: "A quiz item proposed no expected answer." };
      }
      if (form === "quiz" && choices.length > 0 && !choices.includes(expected)) {
        return {
          kind: "neither",
          reason: "A quiz item's expected answer is not among its choices.",
        };
      }
      material.push({
        prompt,
        choices,
        expected,
        explanation: form === "quiz" ? asString(item.explanation) : "",
      });
    }
    return { kind: "draft", form, material };
  }
  return { kind: "neither", reason: "The reply named no recognizable kind." };
}

export function parseKind({ reply }: { reply: string }): string {
  return parse(reply).kind;
}

export function parsedForm({ reply }: { reply: string }): string {
  const reading = parse(reply);
  return reading.kind === "draft" ? reading.form : "";
}

export function parsedMaterial({ reply }: { reply: string }): Entry[] {
  const reading = parse(reply);
  return reading.kind === "draft" ? reading.material : [];
}

export function parsedQuestion({ reply }: { reply: string }): string {
  const reading = parse(reply);
  return reading.kind === "question" ? reading.question : "";
}

export function parsedReason({ reply }: { reply: string }): string {
  const reading = parse(reply);
  return reading.kind === "neither" ? reading.reason : "";
}
