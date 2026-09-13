import { expect, test } from "@playwright/test";
import { call, logIn } from "./support/browser.ts";

interface Message {
  message: string;
  recipient: string;
  subject: string;
}
interface Task {
  task: string;
  title: string;
  path: string;
}

test("task notifications and email links focus their subject, including after sign-in", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const mara = await logIn(page);
  const noah = await logIn(page, "noah");
  const { list } = await call<{ list: string }>(page, mara.cookie, "/tasklists/create", {
    title: "Mail navigation",
  });
  await call(page, mara.cookie, "/tasklists/add-member", { list, candidate: noah.user });
  const window = {
    startsAt: new Date(Date.now() - 3_600_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
  // Enough preceding work that landing at the top would not count as finding the task.
  for (let i = 0; i < 8; i++) {
    await call(page, mara.cookie, "/tasks/create", { list, title: `Other task ${i}`, ...window });
  }
  const tasks: Task[] = [];
  for (const state of ["OPEN", "DONE", "CANCELED"]) {
    const title = `${state.toLowerCase()} notification target`;
    const { task } = await call<{ task: string }>(page, mara.cookie, "/tasks/create", {
      list,
      title,
      details: "Read the **complete brief** before acting.\n\n- First step\n- Second step",
      ...window,
    });
    await call(page, mara.cookie, "/tasks/assign", { task, assignee: noah.user });
    if (state !== "OPEN")
      await call(page, mara.cookie, state === "DONE" ? "/tasks/complete" : "/tasks/cancel", {
        task,
      });
    const { messages } = await call<{ messages: Message[] }>(page, mara.cookie, "/mail/list", {});
    const message = messages.find(
      (message) => message.recipient === "noah@example.edu" && message.subject.includes(title),
    );
    expect(message).toBeDefined();
    const { text } = await call<{ text: string }>(page, mara.cookie, "/mail/read", {
      message: message!.message,
    });
    const destination = new URL(text.trim().split("\n").at(-1)!);
    expect(destination.pathname).toBe(`/groups/${list}`);
    expect(destination.searchParams.get("view")).toBe("tasks");
    expect(destination.searchParams.get("task")).toBe(task);
    tasks.push({ task, title, path: destination.pathname + destination.search });
  }

  // Compile before interactive assertions; dev route compilation can reload an open page.
  for (const path of ["/login", "/notifications", tasks[0].path]) await page.request.get(path);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const target of tasks) {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications", exact: true })).toBeVisible();
    const title = page.getByText(target.title, { exact: true }).first();
    await expect(title).toBeVisible();
    if (target === tasks[0]) {
      await page.screenshot({
        path: testInfo.outputPath("notifications-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({
        path: testInfo.outputPath("notifications-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await title.click();
    await expect(page).toHaveURL(new RegExp(`task=${target.task}`));
    const card = page.locator(`#task-${target.task}`);
    await expect(card.getByRole("heading", { name: target.title, exact: true })).toBeInViewport();
    await expect(card.getByRole("button", { name: "Hide details", exact: true })).toBeVisible();
    await expect(card).toBeFocused();
    expect(
      await page
        .locator("html")
        .evaluate((element, width) => element.scrollWidth <= width + 1, page.viewportSize()!.width),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${target.title}-mobile.png`),
      fullPage: false,
    });
  }

  const target = tasks.at(-1)!;
  await page.context().clearCookies();
  await page.goto(target.path);
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(target.path);
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("noah");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`task=${target.task}`));
  await expect(
    page.locator(`#task-${target.task}`).getByRole("button", { name: "Hide details", exact: true }),
  ).toBeVisible();

  await call(page, mara.cookie, "/tasks/delete", { task: target.task });
  await page.goto(target.path);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "The linked task is no longer available in this group." }),
  ).toBeVisible();

  await call(page, mara.cookie, "/tasklists/remove-member", { list, target: noah.user });
  const { messages } = await call<{ messages: Message[] }>(page, mara.cookie, "/mail/list", {});
  const removal = messages.find(
    (message) =>
      message.recipient === "noah@example.edu" &&
      message.subject.startsWith("You were removed") &&
      message.subject.includes("Mail navigation"),
  );
  expect(removal).toBeDefined();
  const { text } = await call<{ text: string }>(page, mara.cookie, "/mail/read", {
    message: removal!.message,
  });
  expect(new URL(text.trim().split("\n").at(-1)!).pathname).toBe("/groups");
});
