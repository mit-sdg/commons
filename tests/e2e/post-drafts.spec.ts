import { expect, type Page, test } from "@playwright/test";

async function signIn(page: Page) {
  // Warm dynamic routes before interaction: Next dev may reload on first compilation.
  for (const route of ["/login", "/", "/new", "/t/warmup"]) await page.request.get(route);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/");
}

const POSTED = "A discussion to come back to";
const TITLE = "What a draft keeps while I read";
const OPENING = "Half of an opening post, left to go read the thread that prompted it.";
const REPLY = "Half of a reply, left the same way.";
const NESTED = "Half of a reply to the opening post itself.";

test("an unfinished discussion and an unfinished reply survive leaving the page", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  await signIn(page);

  const title = page.getByRole("textbox", { name: "Title", exact: true });
  const body = page.locator("textarea");

  // A posted discussion is what the author leaves their next one to go read.
  await page.goto("/new");
  await title.fill(POSTED);
  await body.fill("Its opening post.");
  await page.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page.waitForURL(/\/t\//);
  const conversation = page.url();

  await page.goto("/new");
  await title.fill(TITLE);
  await body.fill(OPENING);
  await expect(page.getByText("Draft kept in this browser only")).toBeVisible();

  await page.goto(conversation);
  await page.goto("/new");
  await expect(title).toHaveValue(TITLE);
  await expect(body).toHaveValue(OPENING);

  // A reply is kept the same way, under its own discussion.
  await page.goto(conversation);
  const reply = page.locator("textarea").last();
  await reply.fill(REPLY);
  await expect(page.getByText("Draft kept in this browser only")).toBeVisible();
  await page.goto("/");
  await page.goto(conversation);
  await expect(page.locator("textarea").last()).toHaveValue(REPLY);

  // Posting a reply retires its draft and leaves the discussion's own alone.
  await page.getByRole("button", { name: "Post reply", exact: true }).last().click();
  await expect(page.locator("article").filter({ hasText: REPLY })).toHaveCount(1);
  await expect(page.locator("textarea").last()).toHaveValue("");
  await page.reload();
  await expect(page.locator("textarea").last()).toHaveValue("");

  // A reply left unfinished on one post opens that post's own composer again.
  await page.getByRole("button", { name: "Reply", exact: true }).first().click();
  const nested = page.locator("article textarea").first();
  await nested.fill(NESTED);
  await expect(page.getByText("Draft kept in this browser only")).toBeVisible();
  await page.goto("/");
  await page.goto(conversation);
  await expect(page.locator("article textarea").first()).toHaveValue(NESTED);

  // Cancelling that reply drops it: it does not open itself again.
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
  await page.goto("/");
  await page.goto(conversation);
  await expect(page.locator("article textarea")).toHaveCount(0);

  await page.goto("/new");
  await expect(title).toHaveValue(TITLE);
  await expect(body).toHaveValue(OPENING);

  // Discarding drops the writing, and posting drops the draft behind it.
  await page.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(body).toHaveValue("");
  await body.fill(OPENING);
  await page.getByRole("button", { name: "Post discussion", exact: true }).click();
  await page.waitForURL(/\/t\//);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await page.goto("/new");
  await expect(title).toHaveValue("");
  await expect(body).toHaveValue("");
});
