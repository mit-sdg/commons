import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";

/**
 * A sign-in survey read by student, end to end: students answer on phones,
 * and the staff board joins their answers to the roster. A bar opens the
 * students who gave that answer, roster emails read as names, the students
 * who did not hand in are grouped by whether a classmate named them, and the
 * whole table downloads as CSV.
 */

const HOST = { username: "mara", password: "password123" };
const NOAH = { username: "noah", password: "password123" };
const PRIYA = { username: "priya", password: "password123" };

/**
 * Compile every route this test visits before it is clicked through: Next dev
 * reloads a page the first time it compiles a route, and a reload that lands
 * between a click and its navigation is lost.
 */
async function warmRoutes(page: Page) {
  if (process.env.CI || process.env.COMMONS_E2E_STANDALONE === "1") return;
  for (const route of ["/login", "/", "/q/warmup", "/staff/live/run/warmup"])
    await page.request.get(route);
}

async function signIn(page: Page, account = HOST) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

/** Answer the survey on a phone of its own, signed in as `account`. */
async function answerOnPhone(
  browser: Browser,
  token: string,
  account: { username: string; password: string },
  color: string,
  partner: string,
) {
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const participant = await phone.newPage();
  await signIn(participant, account);
  await participant.goto(`/q/${token}`);
  await participant.getByRole("button", { name: "Join", exact: true }).click();
  await participant.getByRole("button", { name: color, exact: true }).click();
  await participant.getByPlaceholder("Your answer").fill(partner);
  await participant.getByPlaceholder("Your answer").blur();
  await expect(participant.getByText("2 of 2 answered")).toBeVisible();
  await participant.getByRole("button", { name: "Hand in", exact: true }).click();
  await expect(participant.getByRole("heading", { name: "Handed in", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await phone.close();
}

test("a sign-in survey reads by student: filtered from a bar, names for emails, groups, and CSV", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  await warmRoutes(page);
  await signIn(page);
  async function call(path: string, data: unknown) {
    const cookie = (await page.context().cookies())
      .map((entry) => `${entry.name}=${entry.value}`)
      .join("; ");
    const result = await page.request.post(`/api${path}`, { data, headers: { Cookie: cookie } });
    expect(result.ok(), path).toBe(true);
    return result.json();
  }

  // Three new accounts: two roster students who will not answer, and one
  // account off the roster who will. Accepting runs on a separate request
  // context so the host stays signed in.
  const tag = Math.random().toString(36).slice(2, 7);
  async function createAccount(first: string, last: string) {
    const username = `${first}_${tag}`.toLowerCase();
    const email = `${first}.${last}.${tag}@example.edu`.toLowerCase();
    const { invitation } = await call("/invitations/invite", { email });
    const accepted = await request.post("/api/auth/accept-invitation", {
      data: {
        invitation,
        temporaryPassword: invitationCredential(invitation),
        username,
        password: "password123",
        displayName: `${first} ${last}`,
      },
    });
    expect(accepted.ok(), `accept ${username}`).toBe(true);
    return { username, password: "password123", email };
  }
  const wren = await createAccount("Wren", "Calloway");
  const idris = await createAccount("Idris", "Fenwick");
  const rosa = await createAccount("Rosa", "Quill");
  await call("/roster/import", {
    rows: ["noah@example.edu", "priya@example.edu", wren.email, idris.email].map((email) => ({
      email,
      kind: "STUDENT",
    })),
  });

  // A survey with a choice question and a written one, launched behind sign-in.
  const title = `Pairing check ${tag}`;
  const { questionnaire } = await call("/live/quizzes/create", { title, form: "survey" });
  const { question: colorQuestion } = await call("/live/quizzes/add-question", {
    questionnaire,
    prompt: "Pick a color",
    choices: ["Red", "Blue"],
  });
  await call("/live/quizzes/add-question", {
    questionnaire,
    prompt: "Who did you work with?",
  });
  const { run, token } = await call("/live/runs/launch", { questionnaire, requireSignIn: true });

  // The board offers no By student view while nobody on the roster has handed in.
  await page.goto(`/staff/live/run/${run}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const lens = page.getByRole("group", { name: "View" });
  await answerOnPhone(browser, token, rosa, "Red", "stranger@nowhere.test");
  await expect(page.getByText("1 answer handed in").first()).toBeVisible({ timeout: 20_000 });
  await expect(lens).toHaveCount(0);

  // Roster students answer; one names Wren with stray case and spaces.
  await answerOnPhone(browser, token, NOAH, "Red", `  ${wren.email.toUpperCase()} `);
  await answerOnPhone(browser, token, PRIYA, "Blue", "noah@example.edu");

  // The switch appears once a roster member has handed in, opened on Summary.
  await expect(page.getByText("3 answers handed in").first()).toBeVisible({ timeout: 20_000 });
  await expect(lens).toBeVisible();
  await expect(lens.getByRole("button", { name: "Summary" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(lens.getByRole("button", { name: "By student" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // A row of the table, by the name it starts with.
  const row = (from: Page, name: string) =>
    from.getByRole("row", { name: new RegExp(`^${name}\\b`) });

  // Clicking the Red bar opens By student, filtered to those who chose Red.
  await page.getByRole("button", { name: /^Red\b/ }).click();
  await expect(lens.getByRole("button", { name: "By student" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const address = new URL(page.url()).searchParams;
  expect(address.get("view")).toBe("students");
  expect(address.get("question")).toBe(colorQuestion);
  expect(address.get("answer")).toBe("Red");
  async function expectFilteredToRed(from: Page) {
    await expect(row(from, "Noah Patel")).toBeVisible();
    await expect(row(from, "Rosa Quill")).toBeVisible();
    await expect(row(from, "Priya Sharma")).toHaveCount(0);
    const chip = from.getByRole("button", { name: "Show every answer to Pick a color" });
    await expect(chip).toHaveText("Red");
    await expect(
      from.getByRole("columnheader", { name: /^Pick a color/ }).getByRole("button", {
        name: "Show every answer to Pick a color",
      }),
    ).toBeVisible();
  }
  await expectFilteredToRed(page);

  // The address alone reopens the same filtered view.
  const linked = await page.context().newPage();
  await linked.goto(page.url());
  await expectFilteredToRed(linked);
  await linked.close();

  // The × clears the filter: every row is back and the address drops it.
  await page.getByRole("button", { name: "Show every answer to Pick a color" }).click();
  await expect(row(page, "Priya Sharma")).toBeVisible();
  await expect(page.getByRole("button", { name: "Show every answer to Pick a color" })).toHaveCount(
    0,
  );
  expect(new URL(page.url()).searchParams.get("answer")).toBeNull();
  expect(new URL(page.url()).searchParams.get("view")).toBe("students");

  // Roster emails read as names, however they were typed; others keep their text and the mark.
  await expect(
    row(page, "Noah Patel").getByRole("button", { name: "Wren Calloway" }),
  ).toBeVisible();
  await expect(row(page, "Priya Sharma").getByRole("button", { name: "Noah Patel" })).toBeVisible();
  await expect(row(page, "Rosa Quill").getByTitle("Not on the roster")).toHaveText(
    /stranger@nowhere\.test/,
  );
  await expect(page.getByRole("button", { name: /1\s*email not on the roster/ })).toBeVisible();

  // The groups below: not handed in, named by a classmate, and answered but not on the roster.
  await expect(page.getByRole("row", { name: /^Not handed in\s*\d+$/ })).toBeVisible();
  await expect(row(page, "Idris Fenwick")).toBeVisible();
  await expect(page.getByRole("row", { name: /^Named by a classmate\s*1$/ })).toBeVisible();
  await expect(row(page, "Wren Calloway")).toContainText("Named by Noah Patel");
  await expect(
    page.getByRole("row", { name: /^Answered but not on the roster\s*1$/ }),
  ).toBeVisible();
  // The account off the roster goes by its profile name, not a number.
  await expect(row(page, "Rosa Quill")).toBeVisible();
  await expect(page.getByText("Unnamed 1")).toHaveCount(0);

  // The CSV holds the whole table: the header, and Wren named by Noah.
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloading;
  const path = await download.path();
  if (!path) throw new Error("The CSV download has no local path");
  const lines = (await readFile(path, "utf8")).split("\r\n");
  expect(lines[0]).toBe("Name,Email,Section,Status,Named by,Pick a color,Who did you work with?");
  expect(lines).toContain(`Wren Calloway,${wren.email},,Named by a classmate,Noah Patel,,`);
  expect(lines).toContain("Rosa Quill,,,Answered but not on the roster,,Red,stranger@nowhere.test");
});
