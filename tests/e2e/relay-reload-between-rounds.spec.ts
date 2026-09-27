import { expect, type Page, test } from "@playwright/test";

/**
 * A phone that hands in, sees its round close, and reloads between rounds
 * keeps its receipt and its wall, and takes the next round when it opens.
 */
async function call<T>(page: Page, path: string, data: unknown): Promise<T> {
  const cookie = (await page.context().cookies())
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: { Cookie: cookie },
  });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as T;
}

test("a phone reloaded between rounds keeps its receipt and takes the next round", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");

  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Reload between rounds",
  });
  const add = (title: string, prompt: string) =>
    call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title,
      prompt,
      parts: [],
      choices: [],
      cap: 0,
    });
  const first = await add("First", "One verb a bookmark needs.");
  const second = await add("Second", "One more verb, then.");
  const { run, token } = await call<{ run: string; token: string }>(page, "/live/relays/launch", {
    relay,
  });

  const phoneContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const phone = await phoneContext.newPage();
  try {
    await phone.goto(`/q/${token}`);
    await expect(phone.getByText("Waiting for the next round")).toBeVisible();

    const opened = await call<{ round: string }>(page, "/live/relays/open-round", {
      run,
      leg: first.leg,
    });
    await expect(phone.getByText("One verb a bookmark needs.")).toBeVisible();
    await phone.getByRole("textbox").first().fill("keep");
    await phone.getByRole("button", { name: "Hand in" }).click();
    await expect(phone.getByText("Response received")).toBeVisible();

    await call(page, "/live/relays/close-round", { round: opened.round });
    await expect(phone.getByText("Waiting for the next round")).toBeVisible();
    await expect(phone.getByText("Response received")).toBeVisible();

    await phone.reload();
    await expect(phone.getByText("Response received")).toBeVisible();
    await expect(phone.getByText("keep")).toBeVisible();
    await expect(phone.getByText("Waiting for the next round")).toBeVisible();

    await call(page, "/live/relays/open-round", { run, leg: second.leg });
    await expect(phone.getByText("One more verb, then.")).toBeVisible();
    await expect(phone.getByRole("button", { name: "Hand in" })).toBeVisible();
  } finally {
    await phoneContext.close();
  }
});
