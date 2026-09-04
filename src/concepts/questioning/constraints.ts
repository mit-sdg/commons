export const QUESTIONING_LIMITS = {
  title: 200,
  questions: 100,
  prompt: 10_000,
  choices: 50,
  choice: 500,
  reference: 2_000,
  explanation: 2_000,
  parts: 12,
  part: 40,
  cap: 20,
} as const;

export type QuestionMaterial = {
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
};

type TitleViolation = { kind: "title"; message: string };

export type PartsViolation = { kind: "parts"; message: string };

export type QuestionParts = {
  parts: string[];
  cap: number;
};

export type QuestionMaterialViolation =
  | { kind: "prompt"; message: string }
  | { kind: "choices"; message: string }
  | { kind: "duplicateChoices"; message: string }
  | { kind: "expected"; message: string }
  | { kind: "reference"; message: string }
  | { kind: "explanation"; message: string };

type ConstraintResult<Value, Violation> =
  | { ok: true; value: Value }
  | { ok: false; violation: Violation };

export function normalizeTitle(title: unknown): ConstraintResult<string, TitleViolation> {
  const normalized = typeof title === "string" ? title.trim() : "";
  if (normalized === "" || normalized.length > QUESTIONING_LIMITS.title) {
    return {
      ok: false,
      violation: { kind: "title", message: "The title must be 1 to 200 characters long." },
    };
  }
  return { ok: true, value: normalized };
}

/** The intrinsic material rules shared by hand-authored and generated questions. */
export function normalizeQuestionMaterial(input: {
  prompt: unknown;
  choices: unknown;
  expected: unknown;
  explanation: unknown;
}): ConstraintResult<QuestionMaterial, QuestionMaterialViolation> {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (prompt === "" || prompt.length > QUESTIONING_LIMITS.prompt) {
    return {
      ok: false,
      violation: {
        kind: "prompt",
        message: "The prompt must be 1 to 10000 characters long.",
      },
    };
  }

  if (!Array.isArray(input.choices) || input.choices.length > QUESTIONING_LIMITS.choices) {
    return {
      ok: false,
      violation: {
        kind: "choices",
        message: "A question may offer at most 50 choices.",
      },
    };
  }
  if (
    input.choices.some(
      (choice) =>
        typeof choice !== "string" ||
        choice.trim() === "" ||
        choice.trim().length > QUESTIONING_LIMITS.choice,
    )
  ) {
    return {
      ok: false,
      violation: {
        kind: "choices",
        message: "Each choice must be 1 to 500 characters long.",
      },
    };
  }
  const choices = (input.choices as string[]).map((choice) => choice.trim());
  const comparisonChoices = choices.map((choice) => choice.toLowerCase());
  if (new Set(comparisonChoices).size !== comparisonChoices.length) {
    return {
      ok: false,
      violation: {
        kind: "duplicateChoices",
        message: "Choices must be distinct, ignoring case and surrounding space.",
      },
    };
  }

  if (typeof input.expected !== "string") {
    return {
      ok: false,
      violation:
        choices.length > 0
          ? { kind: "expected", message: "The expected answer must be a String." }
          : { kind: "reference", message: "A written-answer reference must be a String." },
    };
  }
  const expected = input.expected.trim();
  if (choices.length > 0) {
    if (expected !== "" && !choices.includes(expected)) {
      return {
        ok: false,
        violation: {
          kind: "expected",
          message: "The expected answer must exactly match an offered choice.",
        },
      };
    }
  } else if (expected.length > QUESTIONING_LIMITS.reference) {
    return {
      ok: false,
      violation: {
        kind: "reference",
        message: "A written-answer reference may be at most 2000 characters long.",
      },
    };
  }

  if (typeof input.explanation !== "string") {
    return {
      ok: false,
      violation: { kind: "explanation", message: "An explanation must be a String." },
    };
  }
  const explanation = input.explanation.trim();
  if (explanation.length > QUESTIONING_LIMITS.explanation) {
    return {
      ok: false,
      violation: {
        kind: "explanation",
        message: "An explanation may be at most 2000 characters long.",
      },
    };
  }

  return { ok: true, value: { prompt, choices, expected, explanation } };
}

/**
 * Parts say how a question is answered in pieces. Empty parts with a cap of
 * zero take one answer; nonempty parts with a cap of zero are labeled boxes;
 * exactly one part with a cap of two or more is a repeated box. Any other
 * pairing is not valid.
 */
export function normalizeParts(input: {
  parts: unknown;
  cap: unknown;
}): ConstraintResult<QuestionParts, PartsViolation> {
  const invalid: ConstraintResult<QuestionParts, PartsViolation> = {
    ok: false,
    violation: {
      kind: "parts",
      message: "Parts are up to 12 short labels, or one label repeated up to a cap of 2 to 20.",
    },
  };

  if (!Array.isArray(input.parts) || input.parts.length > QUESTIONING_LIMITS.parts) return invalid;
  if (
    input.parts.some(
      (part) =>
        typeof part !== "string" ||
        part.trim() === "" ||
        part.trim().length > QUESTIONING_LIMITS.part,
    )
  ) {
    return invalid;
  }
  const parts = (input.parts as string[]).map((part) => part.trim());
  const comparisonParts = parts.map((part) => part.toLowerCase());
  if (new Set(comparisonParts).size !== comparisonParts.length) return invalid;

  const cap = input.cap;
  if (typeof cap !== "number" || !Number.isInteger(cap)) return invalid;
  if (cap === 0) return { ok: true, value: { parts, cap } };
  if (cap >= 2 && cap <= QUESTIONING_LIMITS.cap && parts.length === 1) {
    return { ok: true, value: { parts, cap } };
  }
  return invalid;
}
