export interface RunSnapshotQuestion {
  item: string;
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
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

function snapshot(value: unknown): RunSnapshot {
  const candidate = value as RunSnapshot | { presentation: RunSnapshot };
  return "presentation" in candidate ? candidate.presentation : candidate;
}

export function snapshotTitle({ value }: { value: unknown }): string {
  return snapshot(value).title;
}

export function snapshotForm({ value }: { value: unknown }): string {
  return snapshot(value).form;
}

export function snapshotHasQuestion({ value, question }: { value: unknown; question: string }) {
  return snapshot(value).questions.some(({ item }) => item === question);
}

export function snapshotIsWhole({ value, answers }: { value: unknown; answers: Answer[] }) {
  const answered = new Set(answers.map(({ item }) => item));
  return snapshot(value).questions.every(({ item }) => answered.has(item));
}

export function participantQuestions({ value }: { value: unknown }) {
  return snapshot(value).questions.map(({ item, prompt, choices, position }) => ({
    question: item,
    prompt,
    choices,
    position,
  }));
}

export function boardQuestions({ value, values }: { value: unknown; values: RunValue[] }) {
  return snapshot(value).questions.map((question) => ({
    question: question.item,
    prompt: question.prompt,
    choices: question.choices,
    expected: question.expected,
    explanation: question.explanation,
    position: question.position,
    values: values
      .filter(({ item }) => item === question.item)
      .map(({ response, participant, value: answer }) => ({
        response,
        participant,
        value: answer,
      })),
  }));
}

function kindOf(question: RunSnapshotQuestion): "graded" | "reference" | "ungraded" {
  if (question.choices.length > 0 && question.expected !== "") return "graded";
  if (question.choices.length === 0 && question.expected !== "") return "reference";
  return "ungraded";
}

function receipt(value: unknown, answers: Answer[], explain: boolean) {
  const byItem = new Map(answers.map((answer) => [answer.item, answer.value]));
  return snapshot(value).questions.flatMap((question) => {
    const answer = byItem.get(question.item);
    if (answer === undefined) return [];
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
