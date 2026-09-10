import {
  type api,
  CommonsError,
  type Input,
  type Output,
  requestErrorMessage,
  unwrap,
} from "@/lib/api";
import type { MailMessage } from "@/lib/models";

export type TemplateAnswer = Output<"/mail/template">;
export type InvitationTemplate = TemplateAnswer["template"];
export type InvitationDraft = Input<"/mail/save-template">;
export type InvitationPreview = Output<"/mail/preview-template">["preview"];
export type MailDetail = Output<"/mail/read">;

export const SUBJECT_LIMIT = 200;
export const BODY_LIMIT = 20_000;

/** Input affordances only. Saving remains the one authority on what is accepted. */
export function templateInputErrors(draft: InvitationDraft): {
  subject: string | null;
  body: string | null;
} {
  return {
    subject:
      draft.subject.length > SUBJECT_LIMIT ||
      /[\p{Cc}\u2028\u2029]/u.test(draft.subject)
        ? "Use one line, up to 200 characters, without control characters."
        : !draft.subject.trim()
          ? "Enter a subject."
          : null,
    body: !draft.body.trim()
      ? "Enter an invitation body."
      : draft.body.includes("\u0000")
        ? "The body cannot contain null characters."
        : draft.body.length > BODY_LIMIT
          ? "Use up to 20,000 characters."
          : null,
  };
}

export function sameTemplate(
  left: InvitationDraft,
  right: InvitationDraft,
): boolean {
  return left.subject === right.subject && left.body === right.body;
}

export type TemplateOperation = "save" | "reset";

export interface TemplateEditorState {
  saved: InvitationTemplate;
  /** Whether the saved copy is an administrator's own words, or Commons' own. */
  worded: boolean;
  draft: InvitationDraft;
  pending: TemplateOperation | null;
  error: string | null;
  notice: string | null;
}

export function initialTemplateState(
  answer: TemplateAnswer,
): TemplateEditorState {
  return {
    saved: answer.template,
    worded: answer.worded,
    draft: answer.template,
    pending: null,
    error: null,
    notice: null,
  };
}

export type TemplateAction =
  | { type: "edit"; draft: InvitationDraft }
  | { type: "discard" }
  | { type: "start"; operation: TemplateOperation }
  | { type: "stored"; answer: TemplateAnswer }
  | { type: "failed"; message: string };

/** Pending operations serialize edits; a refusal never consumes the draft. */
export function templateEditorReducer(
  state: TemplateEditorState,
  action: TemplateAction,
): TemplateEditorState {
  switch (action.type) {
    case "edit":
      return state.pending
        ? state
        : { ...state, draft: action.draft, error: null, notice: null };
    case "discard":
      return state.pending
        ? state
        : initialTemplateState({ template: state.saved, worded: state.worded });
    case "start":
      return state.pending
        ? state
        : { ...state, pending: action.operation, error: null, notice: null };
    case "stored":
      return {
        ...initialTemplateState(action.answer),
        notice: action.answer.worded
          ? "Invitation wording saved."
          : "Commons' own wording restored.",
      };
    case "failed":
      return { ...state, pending: null, error: action.message };
  }
}

type TemplateClient = Pick<typeof api.mail, "save-template" | "reset-template">;

/**
 * Only these refusals and documented pre-dispatch failures prove no mutation
 * ran. `INVALID_WORDING` is one of them: Wording leaves the wording already
 * standing whole, so a refused save is a plain rejection to show inline, not
 * an uncertain outcome to warn about.
 */
const UNAPPLIED_TEMPLATE_ERRORS = new Set([
  "FORBIDDEN",
  "INVALID_REQUEST",
  "INVALID_WORDING",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "HEADER_RESOLUTION_FAILED",
  "INVALID_INPUT",
]);

/** Only the two mutating template routes run here; neither can send mail. */
export async function performTemplateOperation(
  client: TemplateClient,
  operation: TemplateOperation,
  draft: InvitationDraft,
): Promise<Extract<TemplateAction, { type: "stored" | "failed" }>> {
  try {
    return {
      type: "stored",
      answer: unwrap(
        await (operation === "reset"
          ? client["reset-template"]({})
          : client["save-template"](draft)),
      ),
    };
  } catch (error) {
    const uncertain = !(
      error instanceof CommonsError &&
      UNAPPLIED_TEMPLATE_ERRORS.has(error.code ?? "")
    );
    return {
      type: "failed",
      message:
        requestErrorMessage(error) +
        (uncertain
          ? " The change was not confirmed and may already have applied. Your draft is kept; you can retry."
          : ""),
    };
  }
}

export type MailStatus = "sent" | "failing" | "queued";

/** Delivery status uses returned metadata, never a guess based on the subject. */
export function mailStatus(message: MailMessage): MailStatus {
  if (message.sentAt !== null) return "sent";
  return message.lastError !== null ? "failing" : "queued";
}

export function isFailing(message: MailMessage): boolean {
  return mailStatus(message) === "failing";
}

export function countByStatus(
  messages: readonly MailMessage[],
): Record<MailStatus, number> {
  const counts: Record<MailStatus, number> = { sent: 0, failing: 0, queued: 0 };
  for (const message of messages) counts[mailStatus(message)] += 1;
  return counts;
}

export type MailFilter = MailStatus | "all";

export function filterMail(
  messages: readonly MailMessage[],
  search: string,
  filter: MailFilter,
): MailMessage[] {
  const query = search.trim().toLowerCase();
  return messages.filter(
    (message) =>
      (filter === "all" || mailStatus(message) === filter) &&
      (!query ||
        message.subject.toLowerCase().includes(query) ||
        message.recipient.toLowerCase().includes(query)),
  );
}
