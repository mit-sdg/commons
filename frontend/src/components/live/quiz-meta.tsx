import { Badge } from "@/components/ui/badge";

/** A questionnaire is one of two things, and only a quiz is ever graded. */
export const QUIZ_FORMS = ["quiz", "survey"] as const;

export type QuizForm = (typeof QUIZ_FORMS)[number];

export function isQuizForm(value: string): value is QuizForm {
  return (QUIZ_FORMS as readonly string[]).includes(value);
}

/**
 * The disclosure levels in the order they widen — each reveals everything the
 * one before it does. Disclosure is authored with the questionnaire and frozen
 * into a run's key at launch, so a change here reaches only later runs.
 */
export const DISCLOSURE_OPTIONS = [
  {
    value: "score",
    label: "Score only",
    hint: "Participants see the number they earned and nothing else.",
  },
  {
    value: "answers",
    label: "Score and expected answers",
    hint: "Participants also see what each question expected.",
  },
  {
    value: "explanations",
    label: "Everything, explanations included",
    hint: "Participants also see the explanation written for each question.",
  },
] as const;

export type Disclosure = (typeof DISCLOSURE_OPTIONS)[number]["value"];

export function isDisclosure(value: string): value is Disclosure {
  return DISCLOSURE_OPTIONS.some((option) => option.value === value);
}

export function disclosureLabel(value: string): string {
  return (
    DISCLOSURE_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

export function disclosureHint(value: string): string {
  return (
    DISCLOSURE_OPTIONS.find((option) => option.value === value)?.hint ?? ""
  );
}

export function FormBadge({
  form,
  className,
}: {
  form: string;
  className?: string;
}) {
  const quiz = form === "quiz";
  return (
    <Badge variant={quiz ? "default" : "secondary"} className={className}>
      {quiz ? "Quiz" : "Survey"}
    </Badge>
  );
}
