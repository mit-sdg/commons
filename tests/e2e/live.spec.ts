import { expect, type Page, test } from "@playwright/test";

/**
 * The live-quiz loop, end to end, in real browsers against the real stack:
 * the staff member drafts with the (scripted) reasoner, adopts, launches, and
 * watches the board; a participant joins from the shared address on a second
 * browser context, answers, hands in, and meets their score.
 */

const HOST = { username: "mara", password: "password123" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(HOST.username);
  await page.getByRole("textbox", { name: "Password" }).fill(HOST.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

async function draftAndAdopt(page: Page, request: string) {
  await page.goto("/staff/live/draft");
  const describe = page.getByRole("textbox").first();
  await describe.fill(request);
  await page.getByRole("button", { name: /draft it/i }).click();
  await expect(page.getByRole("button", { name: "Adopt this draft" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Adopt this draft" }).click();
  await page.waitForURL(/\/staff\/live\/[0-9a-f-]{36}$/, { timeout: 20_000 });
}

test("a drafted quiz is adopted, launched, taken on a phone, graded, and closed", async ({
  page,
  browser,
}) => {
  await signIn(page);

  // Draft with the scripted reasoner and adopt into an editable questionnaire.
  await draftAndAdopt(page, "A short quiz about photosynthesis for beginners");
  await expect(page.getByText("Scripted quiz: which gas do plants take in?")).toBeVisible();

  // Launch, landing on the run dashboard with the join address on screen.
  await page.getByRole("button", { name: "Launch" }).first().click();
  await page.waitForURL(/\/staff\/live\/run\//, { timeout: 20_000 });
  await expect(page.getByText("Handed in", { exact: true })).toBeVisible();
  const address = await page.locator("figcaption").first().innerText();
  expect(address).toMatch(/\/q\/[0-9a-f-]{36}$/);

  // A participant joins from another browser entirely — a phone, effectively.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const participant = await phone.newPage();
  await participant.goto(address);
  await participant.getByRole("button", { name: "Join" }).click();

  // The face conceals the answers; the participant supplies their own.
  await expect(participant.getByText("which gas do plants take in?")).toBeVisible();
  expect(await participant.locator("main").innerText()).not.toContain("Expected");
  await participant.getByRole("button", { name: "Carbon dioxide" }).click();
  await participant.getByPlaceholder("Your answer").fill("Chlorophyll");
  await participant.getByPlaceholder("Your answer").blur();
  await expect(participant.getByText("2 of 2 answered")).toBeVisible();
  await participant.getByRole("button", { name: "Hand in" }).click();

  // Grading lands through the reaction and the score arrives by polling.
  await expect(participant.getByText("Your score")).toBeVisible({ timeout: 20_000 });
  await expect(participant.locator("main")).toContainText("2 / 2");

  // The staff board reaches the same state live.
  await expect(page.getByText("1 answer handed in").first()).toBeVisible({ timeout: 20_000 });
  const board = await page.locator("main").innerText();
  expect(board).toContain("Carbon dioxide");

  // Closing the run ends participation: a fresh device finds it closed.
  await page.getByRole("button", { name: "Close run" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close run" }).click();
  await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  const late = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const latecomer = await late.newPage();
  await latecomer.goto(address);
  await expect(latecomer.getByText("This has closed")).toBeVisible({ timeout: 15_000 });

  await phone.close();
  await late.close();
});

test("an ambiguous request comes back as a question and resumes from the answer", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/staff/live/draft");
  const restart = page.getByRole("button", { name: "Start a new draft" });
  if (await restart.isVisible().catch(() => false)) await restart.click();
  const describe = page.getByRole("textbox").first();
  await describe.fill("Something ambiguous about gardening");
  await page.getByRole("button", { name: /draft it/i }).click();

  // The reasoner asks rather than guessing; answering resumes the draft.
  const answerBox = page.getByLabel("Answer the clarifying question");
  await expect(answerBox).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Should this be a quiz or a survey?")).toBeVisible();
  await answerBox.fill("A quiz, please");
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await expect(page.getByText("Clarified quiz", { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("a questionnaire is refined with the reasoner and applied back in place", async ({ page }) => {
  await signIn(page);
  await draftAndAdopt(page, "A short quiz about leaves for beginners");
  const editorUrl = page.url();

  // The desk opens a refining line on the questionnaire as it stands.
  await page.getByRole("button", { name: "Refine with the reasoner" }).click();
  await page.waitForURL(/\/staff\/live\/draft\?brief=/, { timeout: 20_000 });
  await expect(page.getByText("Scripted quiz: which gas do plants take in?")).toBeVisible({
    timeout: 20_000,
  });

  // A plain-language correction returns a revised candidate.
  await page.getByLabel("Request a change to this draft").fill("Tighten the wording");
  await page.getByRole("button", { name: "Request a change" }).click();
  await expect(page.getByText("Corrected quiz: which gas do plants take in?")).toBeVisible({
    timeout: 20_000,
  });

  // Adopting applies the revision back to the same questionnaire.
  await page.getByRole("button", { name: "Adopt this draft" }).click();
  await page.waitForURL(editorUrl, { timeout: 20_000 });
  await expect(page.getByText("Corrected quiz: which gas do plants take in?")).toBeVisible({
    timeout: 20_000,
  });
});
