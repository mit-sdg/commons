import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "@/lib/auth";
import type { TaskInboxNotification } from "@/lib/models";
import { ProfilesProvider } from "@/lib/profiles";
import { mergeInboxes, taskRowHref } from "@/lib/task-notifications";
import { NotificationEntry } from "./notification-row";

const task: TaskInboxNotification = {
  notification: "n1",
  kind: "task-assigned",
  subject: "task-1",
  link: "task-1",
  createdAt: "2026-09-12T12:00:00Z",
  read: false,
  actor: null,
  actorLabel: null,
  list: "group-1",
  listTitle: "Launch plan",
  task: {
    title: "Draft the brief",
    details: "Two pages",
    startsAt: "2026-09-13T12:00:00Z",
    endsAt: "2026-09-13T13:00:00Z",
    assignee: "user-1",
    state: "OPEN",
  },
};
const absentTask = {
  title: null,
  details: null,
  startsAt: null,
  endsAt: null,
  assignee: null,
  state: null,
};

function render(row: TaskInboxNotification) {
  return renderToStaticMarkup(
    <AuthProvider>
      <ProfilesProvider>
        <NotificationEntry
          entry={mergeInboxes([], [row])[0]}
          href={taskRowHref(row)}
          onActivate={() => {}}
          onMarkRead={() => {}}
          onDismiss={() => {}}
        />
      </ProfilesProvider>
    </AuthProvider>,
  );
}

test("the task title is primary, followed by the event and non-repeated context", () => {
  const html = render(task);
  expect(html).toMatch(
    /<p class="[^"]*font-semibold[^"]*">Draft the brief<\/p>/,
  );
  expect(html).toContain("line-clamp-2");
  expect(html.indexOf("Draft the brief")).toBeLessThan(
    html.indexOf("A task was assigned to you"),
  );
  expect(html.match(/Draft the brief/g)).toHaveLength(1);
  expect(html).toContain("Launch plan");
  expect(html).toContain("due");
});

test("a membership row names the group first and the actor separately", () => {
  const html = render({
    ...task,
    kind: "task-list-added",
    subject: "group-1",
    link: "group-1",
    list: null,
    actor: "mara",
    actorLabel: "Mara (@mara)",
    task: absentTask,
  });
  expect(html.indexOf("Launch plan")).toBeLessThan(
    html.indexOf("You were added to a group"),
  );
  expect(html.match(/Launch plan/g)).toHaveLength(1);
  expect(html).toContain("Mara (@mara)");
});

test("a withheld row retains its event but never guesses the missing subject or actor", () => {
  const html = render({
    ...task,
    list: null,
    listTitle: null,
    actorLabel: "Hidden actor",
    task: absentTask,
  });
  expect(html).toContain("A task was assigned to you");
  expect(html).toContain("This task is no longer shown to you");
  expect(html).not.toContain("Draft the brief");
  expect(html).not.toContain("Hidden actor");
  expect(html).toContain('role="button"');
});

test("untrusted task and group titles remain text", () => {
  const html = render({
    ...task,
    listTitle: "<img src=x>",
    task: { ...task.task, title: "<script>bad()</script>" },
  });
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("<img src=x");
});
