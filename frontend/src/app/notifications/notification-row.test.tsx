import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "@/lib/auth";
import {
  forumActionText,
  forumPresentation,
  forumRowHref,
} from "@/lib/forum-notifications";
import type { InboxNotification } from "@/lib/models";
import { ProfilesProvider } from "@/lib/profiles";
import { mergeInboxes } from "@/lib/task-notifications";
import { NotificationEntry } from "./notification-row";

function row(over: Partial<InboxNotification> = {}): InboxNotification {
  return {
    notification: "notification-1",
    kind: "reply",
    link: "post-2",
    read: false,
    conversation: "conversation-1",
    discussionTitle: "How does induction work?",
    assignmentTitle: null,
    createdAt: "2026-09-10T00:00:00Z",
    post: {
      author: "author-1",
      content: "Start with the base case. Thanks @alice!",
      createdAt: "2026-09-10T00:00:00Z",
      editedAt: null,
    },
    actor: {
      user: "author-1",
      username: "maria",
      displayName: "Maria",
      avatar: null,
    },
    ...over,
  };
}

function render(notification: InboxNotification) {
  return renderToStaticMarkup(
    <AuthProvider>
      <ProfilesProvider>
        <NotificationEntry
          entry={mergeInboxes([notification], [])[0]}
          href={forumRowHref(notification)}
          onActivate={() => {}}
          onMarkRead={() => {}}
          onDismiss={() => {}}
        />
      </ProfilesProvider>
    </AuthProvider>,
  );
}

describe("forum event wording and direct navigation", () => {
  test("discussion title is primary, actor is truthful, and excerpt retains mentions", () => {
    const html = render(row());
    expect(html).toContain("How does induction work?");
    expect(html).toContain("Maria");
    expect(html).toContain("replied to your post");
    expect(html).toContain("Start with the base case.");
    expect(html).toContain('href="/u/alice"');
    expect(html.indexOf("How does induction work?")).toBeLessThan(
      html.indexOf("replied to your post"),
    );
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Mark read"');
    expect(html).toContain('aria-label="Dismiss"');
  });

  test("accepted wording never names the answer author as the accepter", () => {
    const notification = row({ kind: "accepted" });
    expect(forumActionText("accepted")).toBe("Your answer was accepted");
    expect(forumPresentation(notification).actor).toBeNull();
    const html = render(notification);
    expect(html).toContain("Your answer was accepted");
    expect(html).toContain("How does induction work?");
    expect(html).toContain("Start with the base case.");
    expect(html).not.toContain("Maria");
    expect(html).not.toContain("accepted your answer");
  });

  test("known actor events keep clear wording", () => {
    for (const [kind, wording] of [
      ["staff_message", "sent a private message to staff"],
      ["addressed", "started a discussion with you"],
      ["reply", "replied to your post"],
      ["followed_reply", "replied in a discussion you follow"],
      ["mention", "mentioned you"],
    ]) {
      expect(forumActionText(kind)).toBe(wording);
      expect(forumPresentation(row({ kind })).actor?.displayName).toBe("Maria");
    }
  });

  test("null splice leaves do not make a fake actor or reveal missing context", () => {
    const notification = row({
      conversation: null,
      discussionTitle: null,
      post: { author: null, content: null, createdAt: null, editedAt: null },
      actor: { user: null, username: null, displayName: null, avatar: null },
    });
    const html = render(notification);
    expect(html).toContain("Discussion update");
    expect(html).toContain("Someone replied to your post");
    expect(html).not.toContain("/u/null");
    expect(html).not.toContain("How does induction work?");
    expect(html).toContain('role="button"');
    expect(forumRowHref(notification)).toBeNull();
  });

  test("a surviving reply uses the supplied generic title, never an inferred opening", () => {
    const html = render(row({ discussionTitle: "Discussion" }));
    expect(html).toContain("Discussion");
    expect(html).toContain("Start with the base case.");
    expect(html).not.toContain("How does induction work?");
  });

  test("unknown kinds use readable copy, not raw identifiers or actor guesses", () => {
    for (const kind of ["future_event_kind", "constructor", "__proto__"]) {
      expect(forumActionText(kind)).toBe("You have a discussion update");
      const html = render(row({ kind }));
      expect(html).toContain("You have a discussion update");
      expect(html).not.toContain(kind);
      expect(html).not.toContain("Maria");
    }
  });

  test("untrusted discussion titles and post excerpts remain text", () => {
    const html = render(
      row({
        discussionTitle: "<script>bad()</script>",
        post: {
          author: "author-1",
          content: "<img src=x onerror=bad()> @alice",
          createdAt: null,
          editedAt: null,
        },
      }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
  });

  test("forum hrefs use the supplied conversation and post without a lookup", () => {
    expect(forumRowHref(row())).toBe("/t/conversation-1#post-post-2");
    expect(forumRowHref(row({ conversation: "a/b", link: "p#x" }))).toBe(
      "/t/a%2Fb#post-p%23x",
    );
    expect(forumRowHref(row({ conversation: null }))).toBeNull();
    expect(forumRowHref(row({ link: "" }))).toBeNull();
  });

  test("assignment presentation and routes do not depend on forum context", () => {
    const notification = row({
      kind: "assignment_released",
      link: "assignment-1",
      assignmentTitle: "Problem set 2",
      conversation: null,
      discussionTitle: null,
    });
    expect(forumRowHref(notification)).toBe("/assignments/assignment-1");
    const html = render(notification);
    expect(html).toContain("A new assignment is available");
    expect(html).toContain("Problem set 2");
    expect(html).not.toContain("Discussion update");
    expect(html).not.toContain("Maria");
  });
});
