import { describe, expect, test } from "bun:test";
import { CommonsError, publicErrorMessage } from "./api";
import {
  countByStatus,
  filterMail,
  type InvitationTemplate,
  initialTemplateState,
  isFailing,
  mailStatus,
  performTemplateOperation,
  sameTemplate,
  type TemplateAnswer,
  type TemplateOperation,
  templateEditorReducer,
  templateInputErrors,
} from "./mail-ui";
import type { MailMessage } from "./models";

const saved: InvitationTemplate = {
  subject: "Welcome",
  body: "Join us.\n\nSee you soon.",
};
const draft: InvitationTemplate = {
  subject: "Your invitation",
  body: "Hello!\n\nWelcome to class.",
};
const standing: TemplateAnswer = { template: saved, worded: true };
type TemplateClient = Parameters<typeof performTemplateOperation>[0];

function clientWith(log: [string, unknown][]): TemplateClient {
  return {
    "save-template": async (input) => {
      log.push(["save", input]);
      return { template: input, worded: true };
    },
    "reset-template": async (input) => {
      log.push(["reset", input]);
      return { template: saved, worded: false };
    },
  };
}

function editing() {
  return templateEditorReducer(initialTemplateState(standing), {
    type: "edit",
    draft,
  });
}

describe("invitation input affordances", () => {
  test("bounded subject and body accept plain text without interpreting markup", () => {
    expect(
      templateInputErrors({
        subject: "s".repeat(200),
        body: "b".repeat(20_000),
      }),
    ).toEqual({ subject: null, body: null });
    expect(
      templateInputErrors({
        subject: "<Hello>",
        body: "**Literal** {{name}}\n<img src=x>",
      }),
    ).toEqual({ subject: null, body: null });
    expect(
      templateInputErrors({
        subject: "s".repeat(201),
        body: "b".repeat(20_001),
      }).subject,
    ).not.toBeNull();
    expect(
      templateInputErrors({ subject: "Welcome", body: "b".repeat(20_001) })
        .body,
    ).not.toBeNull();
  });

  test("body requires nonblank text and rejects NUL without banning plain-text line breaks", () => {
    for (const body of ["", "   ", "\t\r\n"]) {
      expect(templateInputErrors({ subject: "Welcome", body }).body).toBe(
        "Enter an invitation body.",
      );
    }
    for (const body of ["\u0000", "Hello\u0000there"]) {
      expect(templateInputErrors({ subject: "Welcome", body }).body).toBe(
        "The body cannot contain null characters.",
      );
    }
    expect(
      templateInputErrors({ subject: "Welcome", body: "Hello.\n\n\tWelcome!" })
        .body,
    ).toBeNull();
  });

  test("subjects reject blank copy, controls and every line separator", () => {
    for (const subject of [
      "",
      "  ",
      "one\ntwo",
      "one\rtwo",
      "one\ttwo",
      "a\u0000b",
      "a\u0085b",
      "a\u2028b",
      "a\u2029b",
    ]) {
      expect(
        templateInputErrors({ subject, body: "Hello" }).subject,
      ).not.toBeNull();
    }
  });
});

describe("template operations and dirty state", () => {
  test("a pending operation cannot be edited, discarded, or restarted", () => {
    const pending = templateEditorReducer(editing(), {
      type: "start",
      operation: "save",
    });
    expect(templateEditorReducer(pending, { type: "edit", draft: saved })).toBe(
      pending,
    );
    expect(templateEditorReducer(pending, { type: "discard" })).toBe(pending);
    expect(
      templateEditorReducer(pending, { type: "start", operation: "reset" }),
    ).toBe(pending);
  });

  test("save uses the returned authoritative copy as the new clean baseline", async () => {
    const log: [string, unknown][] = [];
    const client = clientWith(log);
    const normalized = {
      subject: "Your invitation",
      body: "Normalized line breaks",
    };
    client["save-template"] = async (input) => {
      log.push(["save", input]);
      return { template: normalized, worded: true };
    };
    let state = templateEditorReducer(editing(), {
      type: "start",
      operation: "save",
    });
    state = templateEditorReducer(
      state,
      await performTemplateOperation(client, "save", state.draft),
    );
    expect(log).toEqual([["save", draft]]);
    expect(state.saved).toEqual(normalized);
    expect(state.draft).toEqual(normalized);
    expect(state.worded).toBe(true);
    expect(state.notice).toBe("Invitation wording saved.");
  });

  test("reset sends no copy and adopts the wording Commons falls back to", async () => {
    const log: [string, unknown][] = [];
    let state = templateEditorReducer(editing(), {
      type: "start",
      operation: "reset",
    });
    state = templateEditorReducer(
      state,
      await performTemplateOperation(clientWith(log), "reset", state.draft),
    );
    expect(log).toEqual([["reset", {}]]);
    expect(state.draft).toEqual(saved);
    expect(state.saved).toEqual(saved);
    expect(state.worded).toBe(false);
    expect(state.notice).toBe("Commons' own wording restored.");
  });

  for (const operation of ["save", "reset"] as const) {
    for (const code of [
      "FORBIDDEN",
      "INVALID_REQUEST",
      "INVALID_WORDING",
      "UNAUTHORIZED",
      "NOT_FOUND",
    ] as const) {
      test(`${operation} refusal ${code} preserves the draft and saved copy`, async () => {
        const refused = async () => ({ error: code });
        const client = {
          "save-template": refused,
          "reset-template": refused,
        } as unknown as TemplateClient;
        const state = templateEditorReducer(
          templateEditorReducer(editing(), { type: "start", operation }),
          await performTemplateOperation(client, operation, draft),
        );
        expect(state.pending).toBeNull();
        expect(state.saved).toEqual(saved);
        expect(state.draft).toEqual(draft);
        // A refusal is a plain rejection: Wording left what stood there whole.
        expect(state.error).toBe(publicErrorMessage(code));
        expect(state.notice).toBeNull();
      });
    }
  }

  for (const code of [
    "NETWORK_ERROR",
    "TIMED_OUT",
    "ABORTED",
    "BAD_JSON",
    "BAD_STATUS",
    "RESPONSE_TOO_LARGE",
    "TRANSPORT_ERROR",
    "HEADER_RESOLUTION_FAILED",
    "INVALID_INPUT",
  ] as const) {
    test(`resolved ${code} preserves draft and distinguishes an unconfirmed mutation`, async () => {
      const failed = async () => ({ error: code });
      const client = {
        "save-template": failed,
        "reset-template": failed,
      } as unknown as TemplateClient;
      for (const operation of ["save", "reset"] as const) {
        const outcome = await performTemplateOperation(
          client,
          operation,
          draft,
        );
        expect(outcome.type).toBe("failed");
        if (outcome.type !== "failed") continue;
        const uncertain =
          code !== "HEADER_RESOLUTION_FAILED" && code !== "INVALID_INPUT";
        expect(outcome.message).toContain(publicErrorMessage(code));
        expect(outcome.message.includes("may already have applied")).toBe(
          uncertain,
        );
        const state = templateEditorReducer(
          templateEditorReducer(editing(), { type: "start", operation }),
          outcome,
        );
        expect(state.pending).toBeNull();
        expect(state.draft).toEqual(draft);
        expect(state.saved).toEqual(saved);
        expect(state.notice).toBeNull();
      }
    });
  }

  test("a timeout can follow an applied save without making the draft look confirmed", async () => {
    let effective = saved;
    const client = clientWith([]);
    client["save-template"] = async (input) => {
      effective = input;
      return { error: "TIMED_OUT" } as never;
    };
    const state = templateEditorReducer(
      templateEditorReducer(editing(), { type: "start", operation: "save" }),
      await performTemplateOperation(client, "save", draft),
    );
    expect(effective).toEqual(draft);
    expect(state.saved).toEqual(saved);
    expect(state.draft).toEqual(draft);
    expect(state.error).toContain("may already have applied");
    expect(state.notice).toBeNull();
  });

  test("an unknown coded exception does not prove a template mutation was refused", async () => {
    const failed = async (): Promise<never> => {
      throw new CommonsError("Private failure detail", "FUTURE_ERROR");
    };
    const client = {
      "save-template": failed,
      "reset-template": failed,
    } as unknown as TemplateClient;
    const outcome = await performTemplateOperation(client, "save", draft);
    expect(outcome.type).toBe("failed");
    if (outcome.type !== "failed") return;
    expect(outcome.message).toContain("may already have applied");
    expect(outcome.message).not.toContain("Private failure detail");
  });

  test("faults, timeouts and cancellation are not misreported as refusals or saves", async () => {
    for (const [error, message] of [
      [new Error("private transport detail"), "Could not reach Commons."],
      [new DOMException("timeout", "TimeoutError"), "The request timed out."],
      [new DOMException("aborted", "AbortError"), "The request was canceled."],
    ] as const) {
      const faulted = async (): Promise<never> => {
        throw error;
      };
      const client = {
        "save-template": faulted,
        "reset-template": faulted,
      } as unknown as TemplateClient;
      for (const operation of ["save", "reset"] as TemplateOperation[]) {
        const outcome = await performTemplateOperation(
          client,
          operation,
          draft,
        );
        expect(outcome.type).toBe("failed");
        if (outcome.type !== "failed") continue;
        expect(outcome.message).toContain(message);
        expect(outcome.message).toContain("not confirmed");
        expect(outcome.message).not.toContain("private transport detail");
        const state = templateEditorReducer(editing(), outcome);
        expect(state.draft).toEqual(draft);
        expect(state.saved).toEqual(saved);
      }
    }
  });

  test("discard restores the last confirmed saved copy and its provenance", () => {
    expect(templateEditorReducer(editing(), { type: "discard" })).toEqual(
      initialTemplateState(standing),
    );
    expect(sameTemplate(saved, draft)).toBe(false);
  });
});

function message(over: Partial<MailMessage> = {}): MailMessage {
  return {
    message: "mail-1",
    subject: "Invitation to class",
    recipient: "student@example.edu",
    createdAt: "2026-09-10T00:00:00Z",
    sentAt: null,
    lastAttemptAt: null,
    attempts: 0,
    lastError: null,
    ...over,
  };
}

describe("outbox metadata filtering", () => {
  const queued = message();
  const failing = message({
    message: "mail-2",
    subject: "Discussion reply",
    lastError: "SMTP unavailable",
    attempts: 2,
  });
  const delivered = message({
    message: "mail-3",
    recipient: "Staff@example.edu",
    sentAt: "2026-09-10T00:01:00Z",
    lastError: "Earlier failure",
    attempts: 1,
  });
  const messages = [queued, failing, delivered];

  test("delivery status comes from returned metadata, and a delivery ends a failure", () => {
    expect(mailStatus(queued)).toBe("queued");
    expect(mailStatus(failing)).toBe("failing");
    expect(mailStatus(delivered)).toBe("sent");
    expect(isFailing(failing)).toBe(true);
    expect(isFailing(delivered)).toBe(false);
    expect(countByStatus(messages)).toEqual({
      queued: 1,
      failing: 1,
      sent: 1,
    });
    expect(countByStatus([])).toEqual({ queued: 0, failing: 0, sent: 0 });
  });

  test("each status filter answers only its own messages", () => {
    expect(filterMail(messages, "", "all")).toEqual(messages);
    expect(filterMail(messages, "", "failing")).toEqual([failing]);
    expect(filterMail(messages, "", "queued")).toEqual([queued]);
    expect(filterMail(messages, "", "sent")).toEqual([delivered]);
  });

  test("subject and recipient search is case-insensitive and composes with the filter", () => {
    expect(filterMail(messages, "  INVITATION ", "all")).toEqual([
      queued,
      delivered,
    ]);
    expect(filterMail(messages, "staff@", "all")).toEqual([delivered]);
    expect(filterMail(messages, "reply", "failing")).toEqual([failing]);
    expect(filterMail(messages, "invitation", "failing")).toEqual([]);
    expect(filterMail([], "", "all")).toEqual([]);
    expect(messages).toHaveLength(3);
  });
});
