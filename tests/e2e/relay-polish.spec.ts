import { logIn } from "./support/browser.ts";
import { expect, type Page, test } from "@playwright/test";

async function call<Value>(page: Page, path: string, data: unknown): Promise<Value> {
  const cookie = (await page.context().cookies())
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, { data, headers: { Cookie: cookie } });
  const result = await response.json();
  expect(result.error).toBeUndefined();
  return result as Value;
}

test("reference selection, separate previews, and Runs navigation", async ({ page }) => {
  test.setTimeout(120_000);
  await logIn(page);
  const documentTitle = `Workshop reading ${crypto.randomUUID()}`;
  const { document } = await call<{ document: string }>(page, "/live/drafts/give-document", {
    title: documentTitle,
    body: "A concept has a purpose, state, and actions.",
  });
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Design workshop",
  });
  for (let index = 0; index < 6; index++) {
    await call(page, "/live/relays/add-round", {
      relay,
      title: `Discussion ${index + 1}`,
      prompt: "Which concepts does a bookmark app need?",
      parts: [],
      cap: 0,
      choices: [],
    });
  }
  await page.goto(`/staff/live/relay/${relay}/edit`);
  const references = page.getByRole("button", {
    name: "References: Documents used for AI edits",
    exact: true,
  });
  await references.click();
  await expect(page.getByText("No reference documents selected.")).toBeVisible();
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.getByRole("checkbox", { name: documentTitle, exact: true }).check();
  await expect
    .poll(
      async () =>
        (await call<{ references: string[] }>(page, "/live/references/get", { subject: relay }))
          .references,
    )
    .toEqual([document]);
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await page.keyboard.press("Escape");
  const sorting = page
    .getByRole("button", { name: "Response sorting 0 piles", exact: true })
    .first();
  await sorting.click();
  await expect(sorting).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("tab", { name: "Example results" }).click();
  await page.getByRole("button", { name: "Generate preview" }).click();
  await expect(page.getByText("AI-generated examples", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const example = page.getByRole("tabpanel").locator("details").first();
  await example.locator("summary").click();
  await expect(example.locator("li").first()).toBeVisible();
  await references.click();
  await page
    .getByRole("button", { name: `Remove reference ${documentTitle}`, exact: true })
    .click();
  await expect(page.getByText("No reference documents selected.")).toBeVisible();
  await expect
    .poll(
      async () =>
        (await call<{ references: string[] }>(page, "/live/references/get", { subject: relay }))
          .references,
    )
    .toEqual([]);
  await page.keyboard.press("Escape");
  expect(
    (
      await call<{ documents: { document: string }[] }>(page, "/live/drafts/documents", {})
    ).documents.some((doc) => doc.document === document),
  ).toBe(true);
  await page.goto(`/staff/live/relay/${relay}#runs`);
  await expect(page.locator("#runs")).toBeFocused();
  await expect(page.locator("#runs")).toBeInViewport();
  expect(await page.evaluate("window.scrollY")).toBeGreaterThan(0);
  await page.goto("/staff/live/draft?kind=survey");
  await expect(page.getByRole("tab", { name: "Survey", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/staff/live/background");
  await expect(page.getByRole("button", { name: "Add document", exact: true })).toBeVisible();
  await expect(page.getByText(documentTitle, { exact: true })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
});
