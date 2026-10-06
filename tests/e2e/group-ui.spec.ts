import { logIn } from "./support/browser.ts";
import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page) {
  await logIn(page);
  await page.goto("/");
}

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
