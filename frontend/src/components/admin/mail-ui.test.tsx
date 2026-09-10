import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { QueryState } from "@/hooks/use-query";
import {
  CommonsError,
  type Output,
  publicErrorMessage,
  requestErrorMessage,
  withRequestErrors,
} from "@/lib/api";
import type { MailDetail } from "@/lib/mail-ui";
import type { MailMessage } from "@/lib/models";
import {
  InvitationTemplateEditor,
  InvitationTemplateForm,
} from "./invitation-template-editor";
import { MailDetailView, MailOutbox } from "./mail-outbox";
import { MailTextPreview } from "./mail-text-preview";

function query<T>(
  data: T | null,
  over: Partial<QueryState<T>> = {},
): QueryState<T> {
  return {
    data,
    loading: false,
    error: null,
    refused: null,
    refetch: () => {},
    ...over,
  };
}

const mail: MailMessage = {
  message: "message-1",
  subject: "Welcome to class",
  recipient: "student@example.edu",
  createdAt: "2026-09-10T00:00:00Z",
  sentAt: null,
  attempts: 2,
  lastAttemptAt: "2026-09-10T00:01:00Z",
  lastError: "SMTP unavailable",
};

describe("safe email rendering", () => {
  test("mail copy remains text, preserves paragraphs, and cannot load or execute HTML", () => {
    const html = renderToStaticMarkup(
      <MailTextPreview
        subject={'<img src="https://bad.test/pixel">'}
        text={
          "First paragraph.\n\n<script>alert(1)</script>\n[link](https://bad.test)\n{{name}}"
        }
        recipient="student@example.edu"
      />,
    );
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("First paragraph.\n\n");
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("{{name}}");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("<a ");
  });

  test("empty message text has an explicit empty state", () => {
    expect(
      renderToStaticMarkup(<MailTextPreview subject="Welcome" text="" />),
    ).toContain("No message text.");
  });
});

describe("template editor rendering", () => {
  test("loading never exposes an empty editable template", () => {
    const html = renderToStaticMarkup(<InvitationTemplateEditor />);
    expect(html).toContain("Loading invitation wording…");
    expect(html).not.toContain("<textarea");
    expect(html).toContain("always appended for you");
  });

  test("effective copy is labeled and bounded, and save starts disabled", () => {
    const html = renderToStaticMarkup(
      <InvitationTemplateForm
        answer={{
          template: { subject: "Hello & welcome", body: "First\n\nSecond" },
          worded: true,
        }}
      />,
    );
    expect(html).toContain("Hello &amp; welcome");
    expect(html).toContain("First\n\nSecond");
    expect(html).toContain('for="invitation-subject"');
    expect(html).toContain('for="invitation-body"');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain('maxLength="20000"');
    expect(html).toMatch(/<textarea[^>]*id="invitation-body"[^>]*required=""/);
    expect(html).toMatch(
      /<button[^>]*type="submit"[^>]*disabled=""[^>]*>Save wording<\/button>/,
    );
    // The preview follows the draft; there is no button to press for it.
    expect(html).toContain("Live preview");
    expect(html).not.toContain("Preview draft");
    expect(html).toContain("Your wording is saved and in use.");
    expect(html).not.toContain("Sample password");
  });

  test("Commons' own wording is named as such, and cannot be withdrawn again", () => {
    const html = renderToStaticMarkup(
      <InvitationTemplateForm
        answer={{
          template: { subject: "Your Commons invitation", body: "Welcome." },
          worded: false,
        }}
      />,
    );
    expect(html).toContain("Commons&#x27; own wording is in use.");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>.*Use Commons&#x27; wording<\/button>/,
    );
  });
});

test("invalid body copy names the issue and holds the preview back", () => {
  for (const body of ["   ", "Hello\u0000there"]) {
    const html = renderToStaticMarkup(
      <InvitationTemplateForm
        answer={{ template: { subject: "Welcome", body }, worded: true }}
      />,
    );
    expect(html).toContain(
      body.trim()
        ? "The body cannot contain null characters."
        : "Enter an invitation body.",
    );
    expect(html).toMatch(/<textarea[^>]*aria-invalid="true"/);
    expect(html).toContain("Paused — fix the wording above.");
    expect(html).toContain("Fix the wording to see the preview.");
  }
});

describe("outbox loading and disclosure", () => {
  test("the initial list contains metadata and keyboard controls, not message detail", () => {
    const html = renderToStaticMarkup(
      <MailOutbox mailQuery={query({ messages: [mail] })} />,
    );
    expect(html).toContain("Welcome to class");
    expect(html).toContain("student@example.edu");
    expect(html).toContain("SMTP unavailable");
    expect(html).toContain("2 failed attempts");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Read email: Welcome to class"');
    expect(html).toContain("Search subject or recipient");
    expect(html).toContain("Filter by delivery status");
    expect(html).not.toContain("Loading message");
    expect(html).not.toContain("credentials are redacted");
    expect(html).not.toContain("<article");
  });

  test("search has its own full-width mobile row before the controls", () => {
    const html = renderToStaticMarkup(
      <MailOutbox mailQuery={query({ messages: [mail] })} />,
    );
    expect(html).toContain("flex flex-col gap-3 sm:flex-row sm:items-end");
    expect(html).toContain("w-full min-w-0 space-y-1.5 sm:flex-1");
  });

  test("each status filter carries its own count of the loaded messages", () => {
    const html = renderToStaticMarkup(
      <MailOutbox
        mailQuery={query({
          messages: [
            mail,
            { ...mail, message: "message-2", lastError: null, attempts: 0 },
            {
              ...mail,
              message: "message-3",
              sentAt: "2026-09-10T00:02:00Z",
              lastError: null,
              attempts: 0,
            },
          ],
        })}
      />,
    );
    for (const label of ["All", "Failing", "Queued", "Sent"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/All<[^>]*>3</);
    expect(html).toMatch(/Failing<[^>]*>1</);
  });

  test("zero failed sends are not presented as zero total attempts", () => {
    const html = renderToStaticMarkup(
      <MailOutbox
        mailQuery={query({
          messages: [{ ...mail, attempts: 0, lastError: null }],
        })}
      />,
    );
    expect(html).not.toContain("0 attempts");
    expect(html).not.toContain("0 failed attempts");
  });

  test("list loading, empty, refused and transport-failure states are visible", () => {
    expect(
      renderToStaticMarkup(
        <MailOutbox
          mailQuery={query<Output<"/mail/list">>(null, { loading: true })}
        />,
      ),
    ).toContain("Loading outbox…");
    expect(
      renderToStaticMarkup(<MailOutbox mailQuery={query({ messages: [] })} />),
    ).toContain("No email yet");
    for (const error of [
      publicErrorMessage("FORBIDDEN"),
      requestErrorMessage(new Error("offline")),
    ]) {
      const html = renderToStaticMarkup(
        <MailOutbox mailQuery={query<Output<"/mail/list">>(null, { error })} />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain(error);
      expect(html).toContain("Try again");
    }
  });

  test("opened detail shows safe server-redacted text with its own subject and recipient", () => {
    const data: MailDetail = {
      message: mail.message,
      subject: mail.subject,
      recipient: mail.recipient,
      text: "Hello.\n\nTemporary password: [redacted]",
    };
    const html = renderToStaticMarkup(<MailDetailView query={query(data)} />);
    expect(html).toContain("Temporary password: [redacted]");
    expect(html).toContain("credentials are redacted");
    expect(html).toContain("Welcome to class");
    expect(html).toContain("student@example.edu");
    expect(html).toContain("Hello.\n\n");
    expect(html).not.toContain("<a ");
  });

  test("detail loading and missing/deleted refusals never present stale body text", () => {
    expect(
      renderToStaticMarkup(
        <MailDetailView query={query<MailDetail>(null, { loading: true })} />,
      ),
    ).toContain("Loading message…");
    for (const refused of ["NOT_FOUND", "FORBIDDEN", "UNAUTHORIZED"]) {
      const html = renderToStaticMarkup(
        <MailDetailView
          query={query<MailDetail>(null, {
            error: publicErrorMessage(refused),
            refused,
          })}
        />,
      );
      expect(html).toContain(
        refused === "NOT_FOUND"
          ? "This message is no longer available"
          : publicErrorMessage(refused),
      );
      expect(html).toContain("Try again");
      expect(html).not.toContain("<article");
    }
  });

  test("resolved client faults render safe retry states in outbox and detail, never deleted-message copy", async () => {
    for (const code of [
      "NETWORK_ERROR",
      "TIMED_OUT",
      "ABORTED",
      "BAD_JSON",
      "BAD_STATUS",
      "RESPONSE_TOO_LARGE",
      "HEADER_RESOLUTION_FAILED",
      "INVALID_INPUT",
      "TRANSPORT_ERROR",
    ]) {
      try {
        await withRequestErrors(async () => ({
          error: code,
          detail: "private response",
        }));
        throw new Error("Expected client fault");
      } catch (failure) {
        expect(failure).toBeInstanceOf(CommonsError);
        const fault = failure as CommonsError;
        for (const surface of [
          <MailDetailView
            key="detail"
            query={query<MailDetail>(null, {
              error: fault.message,
              refused: fault.code,
            })}
          />,
          <MailOutbox
            key="outbox"
            mailQuery={query<Output<"/mail/list">>(null, {
              error: fault.message,
              refused: fault.code,
            })}
          />,
        ]) {
          const html = renderToStaticMarkup(surface);
          expect(html).toContain(publicErrorMessage(code));
          expect(html).toContain("Try again");
          expect(html).not.toContain("may have been deleted");
          expect(html).not.toContain("private response");
          expect(html).not.toContain("<article");
        }
      }
    }
  });

  test("detail transport failures and timeout/cancellation are distinct from a missing message", () => {
    for (const fault of [
      new Error("offline"),
      new DOMException("timeout", "TimeoutError"),
      new DOMException("canceled", "AbortError"),
    ]) {
      const error = requestErrorMessage(fault);
      const html = renderToStaticMarkup(
        <MailDetailView query={query<MailDetail>(null, { error })} />,
      );
      expect(html).toContain(error);
      expect(html).not.toContain("may have been deleted");
    }
  });
});
