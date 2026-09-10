import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page) {
  // Warm dynamic routes before interaction: Next dev may reload on first compilation.
  for (const route of ["/login", "/", "/tasks", "/groups", "/groups/warmup", "/new", "/t/warmup"])
    await page.request.get(route);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
}

async function contained(page: Page) {
  await expect(page.getByRole("dialog", { name: "New task", exact: true })).toBeVisible();
  const viewport = page.viewportSize()!;
  const overflow = await page.locator('[role="dialog"]').evaluateAll(
    (dialogs, viewport) =>
      dialogs.flatMap((dialog) => {
        const box = dialog.getBoundingClientRect();
        const errors =
          box.left < -1 ||
          box.right > viewport.width + 1 ||
          box.top < -1 ||
          box.bottom > viewport.height + 1
            ? ["dialog exceeds viewport"]
            : [];
        if (dialog.scrollWidth > dialog.clientWidth + 1) errors.push("dialog scrolls horizontally");
        for (const control of dialog.querySelectorAll("input,textarea,select,button")) {
          const bounds = control.getBoundingClientRect();
          if (bounds.left < box.left - 1 || bounds.right > box.right + 1)
            errors.push(control.outerHTML.slice(0, 120));
        }
        return errors;
      }),
    viewport,
  );
  expect(overflow).toEqual([]);
  expect(
    await page.locator("html").evaluate((el, width) => el.scrollWidth <= width + 1, viewport.width),
  ).toBe(true);
}

test("task dialogs fit desktop, narrow screens and enlarged text", async ({ page }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await signIn(page);
  for (const width of [1710, 755, 390, 320]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto("/tasks");
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "New task" })).toBeVisible();
    await contained(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("link", { name: "Course Launch Tasks", exact: true }).last().click();
    await page.waitForURL(/\/groups\/.*view=tasks/);
    await expect(
      page.getByRole("heading", { name: "Course Launch Tasks", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New task", exact: true }).click();
    await contained(page);
    await page.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.setViewportSize({ width: 855, height: 491 });
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page.addStyleTag({ content: "html { font-size: 32px; }" });
  await contained(page);
  await page.getByRole("button", { name: "Add task", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeInViewport();
});

test("people dropdown scrolls and selects by keyboard; group discussion preserves origin", async ({
  page,
}) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(15_000);
  await signIn(page);
  await page.goto("/groups");
  await page.getByRole("button", { name: "Create group", exact: true }).click();
  await page.getByRole("button", { name: "Add people…" }).click();
  await page.route("**/api/users/search", (route) =>
    route.fulfill({
      json: {
        users: Array.from({ length: 50 }, (_, i) => ({
          user: `sample-${i}`,
          username: `student${i}`,
          profile: { displayName: `Student ${i}` },
        })),
      },
    }),
  );
  await page.getByRole("combobox", { name: "Search people" }).fill("student");
  await expect(page.getByRole("option")).toHaveCount(50);
  expect(
    await page
      .getByRole("listbox", { name: "People" })
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page.getByRole("combobox", { name: "Search people" }).press("ArrowDown");
  await page.getByRole("combobox", { name: "Search people" }).press("Enter");
  await expect(page.getByRole("button", { name: "Remove Student 1" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.unroute("**/api/users/search");
  await page.getByRole("link", { name: /Course Launch Tasks/ }).click();
  await page.waitForURL(/\/groups\/[^/?]+/);
  const groupUrl = page.url();
  await page.getByRole("button", { name: "Group settings", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Rename group", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Rename group", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Group name", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "New discussion", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "New discussion in Course Launch Tasks", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Who can see this\? / })).toHaveCount(0);
  await expect(page.getByLabel("Audience", { exact: true })).toContainText("Course Launch Tasks");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Context navigation check");
  await page.locator("textarea").fill("A discussion for this group.");
  await page.getByRole("button", { name: "Who can see this discussion?" }).click();
  await expect(
    page.getByText("Current group and section members can read this discussion.", { exact: false }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page.waitForURL(/\/t\/.*fromGroup=/);
  const threadUrl = page.url();
  await page.getByRole("link", { name: "Course Launch Tasks", exact: true }).first().click();
  await expect(page).toHaveURL(`${groupUrl.split("?")[0]}?view=discussions`);
  await page.getByRole("link", { name: "Context navigation check", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Course Launch Tasks", exact: true }).first(),
  ).toBeVisible();
  await page.goto(threadUrl.split("?")[0]!);
  await expect(page.getByRole("link", { name: "All discussions", exact: true })).toBeVisible();
});

test("role editor includes live hosting from the shared registry; global composer stays flexible", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Roles", exact: true }).click();
  await expect(page.getByRole("button", { name: /^live:host/ })).toBeVisible();
  await page.goto("/new");
  await expect(page.getByRole("heading", { name: "New discussion", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Who can see this\? / })).toBeVisible();
});
