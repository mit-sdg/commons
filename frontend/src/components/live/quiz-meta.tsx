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
  { value: "score", label: "Score only" },
  { value: "answers", label: "Score and answers" },
  { value: "explanations", label: "Score, answers, and explanations" },
] as const;

export type Disclosure = (typeof DISCLOSURE_OPTIONS)[number]["value"];

export function isDisclosure(value: string): value is Disclosure {
  return DISCLOSURE_OPTIONS.some((option) => option.value === value);
}

/**
 * What a refusal means once a run is open: the questionnaire is frozen for as
 * long as the room is answering it. Every surface that can meet that conflict
 * says it the same way.
 */
export const RUN_OPEN_MESSAGE = "A run is open — editing is locked.";

/** Why a quiz cannot launch yet; the shelf and the desk say it the same way. */
export const QUIZ_NOT_READY_MESSAGE = "No question has a marked answer.";

/**
 * The one look a chosen segment takes on the live screens — the kind selectors
 * here, the round editor's kinds, the dashboard's Pick: a solid foreground
 * fill, in both themes.
 */
export const KIND_SEGMENT =
  "data-[state=active]:bg-foreground data-[state=active]:text-background dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-foreground dark:data-[state=active]:text-background";

const FORM_LABELS: Record<string, string> = {
  quiz: "Quiz",
  survey: "Survey",
  relay: "Relay",
};

/** What retiring costs, said the same way wherever it is confirmed. */
export const RETIRE_NOTE =
  "It can no longer be edited or launched. Past runs and their answers are retained.";

export function FormBadge({
  form,
  className,
}: {
  form: string;
  className?: string;
}) {
  return (
    <Badge
      variant={
        form === "quiz" ? "default" : form === "relay" ? "outline" : "secondary"
      }
      className={className}
    >
      {FORM_LABELS[form] ?? "Survey"}
    </Badge>
  );
}
