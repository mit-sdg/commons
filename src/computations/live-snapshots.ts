export interface RunSnapshotQuestion {
  item: string;
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
  parts?: string[];
  cap?: number;
  position: number;
}

export interface RunSnapshot {
  title: string;
  form: string;
  disclosure: string;
  questions: RunSnapshotQuestion[];
}

interface Answer {
  item: string;
  value: string;
}

interface RunValue extends Answer {
  response: string;
  participant: string;
}

const NOTHING: RunSnapshot = { title: "", form: "", disclosure: "", questions: [] };

function snapshot(value: unknown): RunSnapshot {
  if (value === null || typeof value !== "object") return NOTHING;
  const candidate = value as RunSnapshot | { presentation: RunSnapshot };
  return "presentation" in candidate ? candidate.presentation : candidate;
}

const partsOf = (question: RunSnapshotQuestion): string[] => question.parts ?? [];
const capOf = (question: RunSnapshotQuestion): number => question.cap ?? 0;

/**
 * Every item a question is answered under: itself when it has no parts, one
 * `question#n` per labeled part, or `question#1..cap` for a repeated box.
 */
export function questionItems(question: RunSnapshotQuestion): string[] {
  const parts = partsOf(question);
  const cap = capOf(question);
  if (parts.length === 0) return [question.item];
  const count = cap >= 2 ? cap : parts.length;
  return Array.from({ length: count }, (_, index) => `${question.item}#${index + 1}`);
}

function questionOfItem(questions: RunSnapshotQuestion[], item: string) {
  const [question] = item.split("#");
  return questions.find((candidate) => candidate.item === question);
}

/** The label a part's item answers under: its name, or the repeated box's name. */
export function partLabel({ value, item }: { value: unknown; item: string }): string {
  const question = questionOfItem(snapshot(value).questions, item);
  if (question === undefined) return "";
  const parts = partsOf(question);
  const index = Number(item.split("#")[1] ?? "0");
  if (parts.length === 0 || index === 0) return "";
  return capOf(question) >= 2 ? (parts[0] ?? "") : (parts[index - 1] ?? "");
}

export function snapshotTitle({ value }: { value: unknown }): string {
  return snapshot(value).title;
}

export function snapshotForm({ value }: { value: unknown }): string {
  return snapshot(value).form;
}

export function snapshotHasQuestion({ value, question }: { value: unknown; question: string }) {
  return snapshot(value).questions.some((candidate) => questionItems(candidate).includes(question));
}

export function snapshotIsWhole({ value, answers }: { value: unknown; answers: Answer[] }) {
  const answered = new Set(answers.map(({ item }) => item));
  return snapshot(value).questions.every((question) => {
    const items = questionItems(question);
    return capOf(question) >= 2
      ? items.some((item) => answered.has(item))
      : items.every((item) => answered.has(item));
  });
}

export function participantQuestions({ value }: { value: unknown }) {
  return snapshot(value).questions.map((question) => ({
    question: question.item,
    prompt: question.prompt,
    choices: question.choices,
    parts: partsOf(question),
    cap: capOf(question),
    position: question.position,
  }));
}

export function boardQuestions({ value, values }: { value: unknown; values: RunValue[] }) {
  return snapshot(value).questions.map((question) => {
    const items = new Set(questionItems(question));
    return {
      question: question.item,
      prompt: question.prompt,
      choices: question.choices,
      expected: question.expected,
      explanation: question.explanation,
      parts: partsOf(question),
      cap: capOf(question),
      position: question.position,
      values: values
        .filter(({ item }) => items.has(item))
        .map(({ response, participant, item, value: answer }) => ({
          response,
          participant,
          part: partLabel({ value, item }),
          value: answer,
        })),
    };
  });
}

function kindOf(question: RunSnapshotQuestion): "graded" | "reference" | "ungraded" {
  if (question.choices.length > 0 && question.expected !== "") return "graded";
  if (question.choices.length === 0 && question.expected !== "") return "reference";
  return "ungraded";
}

function receipt(value: unknown, answers: Answer[], explain: boolean) {
  const byItem = new Map(answers.map((answer) => [answer.item, answer.value]));
  return snapshot(value).questions.flatMap((question) => {
    const written = questionItems(question)
      .map((item) => byItem.get(item))
      .filter((entry): entry is string => entry !== undefined);
    if (written.length === 0) return [];
    const answer = written.join(" · ");
    const row = {
      item: question.item,
      prompt: question.prompt,
      value: answer,
      kind: kindOf(question),
      standard: question.expected,
    };
    return [explain ? { ...row, explanation: question.explanation } : row];
  });
}

export function answerReceipt({ value, answers }: { value: unknown; answers: Answer[] }) {
  return receipt(value, answers, false);
}

export function explanationReceipt({ value, answers }: { value: unknown; answers: Answer[] }) {
  return receipt(value, answers, true);
}
