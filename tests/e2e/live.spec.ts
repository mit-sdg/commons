import { expect, type Page, test } from "@playwright/test";

/**
 * The live-quiz loop, end to end, in real browsers against the real stack:
 * the staff member drafts with the (scripted) reasoner, adopts, launches, and
 * watches the board; a participant joins from the shared address on a second
 * browser context, answers, hands in, and meets their score.
 */

const HOST = { username: "mara", password: "password123" };
const NOAH = { username: "noah", password: "password123" };
const PRIYA = { username: "priya", password: "password123" };

/**
 * Compile every route this loop visits before it is clicked through: Next dev
 * reloads a page the first time it compiles a route, and a reload that lands
 * between a click and its navigation is lost.
 */
async function warmRoutes(page: Page) {
  if (process.env.CI || process.env.COMMONS_E2E_STANDALONE === "1") return;
  for (const route of [
    "/login",
    "/",
    "/join",
    "/q/warmup",
    "/staff/live",
    "/staff/live/draft",
    "/staff/live/warmup/edit",
    "/staff/live/run/warmup",
  ])
    await page.request.get(route);
}

async function signIn(page: Page, account = HOST) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

async function draftAndAdopt(page: Page, request: string) {
  await page.goto("/staff/live/draft");
  const describe = page.getByRole("textbox").first();
  await describe.fill(request);
  await page.getByRole("button", { name: "Draft", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adopt this draft" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: "Adopt this draft" }).click();
  await page.waitForURL(/\/staff\/live\/[0-9a-f-]{36}\/edit$/, { timeout: 20_000 });
}

test("a drafted quiz is adopted, launched, taken on a phone, graded, and closed", async ({
  page,
  browser,
}) => {
  // The longest loop in the suite: two participants, a dropped hand-in, and a
  // closed run.
  test.setTimeout(180_000);
  await warmRoutes(page);
  await signIn(page);

  // Draft with the scripted reasoner and adopt into an editable questionnaire.
  await draftAndAdopt(page, "A short quiz about photosynthesis for beginners");
  await expect(page.getByText("Scripted quiz: which gas do plants take in?")).toBeVisible();
  const title = page.getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue("AI-generated quiz");
  await title.fill("Plant check");
  await expect(page.getByRole("button", { name: "Launch" })).toBeDisabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Launch" })).toBeEnabled();

  // Launch, landing on the run dashboard with the room code on screen.
  await page.getByRole("button", { name: "Launch" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Launch", exact: true }).click();
  await page.waitForURL(/\/staff\/live\/run\//, { timeout: 20_000 });
  await expect(page.getByText("Handed in", { exact: true })).toBeVisible();
  const code = await page.locator("figcaption span").first().innerText();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // A participant joins from another browser entirely — a phone, effectively.
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const participant = await phone.newPage();
  await signIn(participant, NOAH);
  await participant.goto("/join");
  await participant.getByRole("textbox", { name: "Code" }).fill(code);
  await participant.getByRole("button", { name: "Join" }).click();
  await participant.waitForURL(/\/q\/[0-9a-f-]{36}(\?by=code)?$/);
  await participant.getByRole("button", { name: "Join" }).click();

  // The face conceals the answers; the participant supplies their own.
  await expect(participant.getByRole("heading", { name: "Plant check" })).toBeVisible();
  await expect(participant.getByText("which gas do plants take in?")).toBeVisible();
  expect(await participant.locator("main").innerText()).not.toContain("Expected");
  await participant.getByRole("button", { name: "Carbon dioxide" }).click();
  await participant.getByPlaceholder("Your answer").fill("Chlorophyll");
  await participant.getByPlaceholder("Your answer").blur();
  await expect(participant.getByText("2 of 2 answered")).toBeVisible();
  // The hand-in commits, but its response disappears in transit. Outcome
  // reconciliation must still move the participant to their receipt.
  await participant.route(
    "**/api/live/p/submit",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await participant.getByRole("button", { name: "Hand in" }).click();

  // Grading lands through the reaction and the score arrives by polling.
  await expect(participant.getByText("Your score")).toBeVisible({ timeout: 20_000 });
  await expect(participant.locator("main")).toContainText("1 / 1");

  // A second signed-in student on the same browser profile gets a distinct
  // response instead of inheriting the first student's submitted outcome.
  await participant.goto("/");
  await participant.getByRole("button", { name: "Account menu" }).click();
  await participant.getByRole("menuitem", { name: "Sign out" }).click();
  await signIn(participant, PRIYA);
  await participant.goto("/join");
  await participant.getByRole("textbox", { name: "Code" }).fill(code);
  await participant.getByRole("button", { name: "Join" }).click();
  await participant.waitForURL(/\/q\/[0-9a-f-]{36}(\?by=code)?$/);
  await expect(participant.getByRole("button", { name: "Join" })).toBeVisible();
  await expect(participant.getByText("Your score")).toBeHidden();
  await participant.getByRole("button", { name: "Join" }).click();
  await participant.getByRole("button", { name: "Oxygen" }).click();
  await participant.getByPlaceholder("Your answer").fill("Chlorophyll");
  await participant.getByRole("button", { name: "Hand in" }).click();
  await expect(participant.getByText("Your score")).toBeVisible({ timeout: 20_000 });
  await expect(participant.locator("main")).toContainText("0 / 1");

  // The staff board reaches both participants' state live.
  await expect(page.getByText("2 answers handed in").first()).toBeVisible({ timeout: 20_000 });
  const board = await page.locator("main").innerText();
  expect(board).toContain("Carbon dioxide");

  // Closing the run ends participation: a fresh device finds it closed.
  await page.getByRole("button", { name: "Close run" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close run" }).click();
  await expect(page.getByText("closed", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  const late = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const latecomer = await late.newPage();
  await latecomer.goto("/join");
  await latecomer.getByRole("textbox", { name: "Code" }).fill(code);
  await latecomer.getByRole("button", { name: "Join" }).click();
  await expect(latecomer.getByText("This quiz has been closed")).toBeVisible({ timeout: 15_000 });

  await phone.close();
  await late.close();
});

for (const form of ["quiz"] as ("quiz" | "survey" | "relay")[]) {
  test(`${form}: require sign-in redirects before restored progress or auto-join can participate`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
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
    let material: string;
    let leg: string | undefined;
    if (form === "relay") {
      material = (await call("/live/relays/plan", { title: "Sign-in relay" })).relay;
      leg = (
        await call("/live/relays/add-round", {
          relay: material,
          title: "Choose",
          prompt: "Choose A",
          parts: [],
          cap: 0,
          choices: ["A", "B"],
        })
      ).leg;
      await page.goto(`/staff/live/relay/${material}`);
    } else {
      material = (await call("/live/quizzes/create", { title: `Sign-in ${form}`, form }))
        .questionnaire;
      await call("/live/quizzes/add-question", {
        questionnaire: material,
        prompt: "Choose A",
        choices: ["A", "B"],
        expected: "A",
      });
      await page.goto(`/staff/live/${material}`);
    }
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const toggle = dialog.getByRole("checkbox", { name: /Require sign-in/ });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    // Cancel creates no run, and each new launch starts with the default choice.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Launch", exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    const launchResponse = page.waitForResponse((response) =>
      response
        .url()
        .endsWith(form === "relay" ? "/api/live/relays/launch" : "/api/live/runs/launch"),
    );
    await dialog.getByRole("button", { name: "Launch", exact: true }).click();
    const { run, token } = await (await launchResponse).json();
    await page.waitForURL(/\/staff\/live\/run\//);
    if (form === "relay") await call("/live/relays/open-round", { run, leg });

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let releaseAuth = () => {};
    let releaseArrival = () => {};
    try {
      await phone.addInitScript(
        ({ token }) => {
          localStorage.setItem("commons-live-device", "restored-phone");
          localStorage.setItem(
            `commons-live-${token}:device:restored-phone`,
            JSON.stringify({ response: "old-anonymous-response", answers: {}, submitted: true }),
          );
        },
        { token },
      );
      const participant = await phone.newPage();
      const authGate = new Promise<void>((resolve) => {
        releaseAuth = resolve;
      });
      await participant.route("**/api/auth/me", async (route) => {
        await authGate;
        await route.continue();
      });
      const responseRequests: string[] = [];
      participant.on("request", (request) => {
        if (/\/api\/live\/p\/(begin|answer|submit|outcome|wall)/.test(request.url()))
          responseRequests.push(request.url());
      });
      const arrivalGate = new Promise<void>((resolve) => {
        releaseArrival = resolve;
      });
      await participant.route("**/api/live/p/arrive", async (route) => {
        await arrivalGate;
        await route.continue();
      });
      if (form === "relay") {
        // Make the server-committed/browser-not-yet-settled window deterministic:
        // restoration is meaningful only after this phone has received its receipt.
        await participant.route("**/api/live/p/submit-signed", async (route) => {
          const response = await route.fetch();
          await new Promise((resolve) => setTimeout(resolve, 250));
          await route.fulfill({ response });
        });
      }
      const arriving = participant.waitForRequest((request) =>
        request.url().endsWith("/api/live/p/arrive"),
      );
      await participant.goto(`/q/${token}?by=code`);
      await expect(participant.getByText("Checking your session…")).toBeVisible();
      expect(responseRequests).toEqual([]);
      releaseAuth();
      await arriving;
      await expect(participant.getByText("Opening…")).toBeVisible();
      expect(responseRequests).toEqual([]);
      releaseArrival();
      await participant.waitForURL(/\/login\?next=/);
      expect(new URL(participant.url()).searchParams.get("next")).toBe(`/q/${token}?by=code`);
      expect(responseRequests).toEqual([]);
      await expect(participant.getByRole("textbox", { name: "Username" })).toBeVisible();
      await participant.getByRole("textbox", { name: "Username" }).fill(NOAH.username);
      await participant.getByRole("textbox", { name: "Password" }).fill(NOAH.password);
      await participant.getByRole("button", { name: "Sign in" }).click();
      await participant.waitForURL(new RegExp(`/q/${token}`));
      if (form !== "relay")
        await participant.getByRole("button", { name: "Join", exact: true }).click();
      const answered = participant.waitForResponse((response) =>
        response.url().endsWith("/api/live/p/answer-signed"),
      );
      await participant.getByRole("button", { name: "A", exact: true }).click();
      expect((await answered).ok()).toBe(true);
      if (form === "quiz") {
        // End the session externally while this tab still holds its identity.
        // The participant must retain the answer and resume the same response.
        expect(
          await participant.evaluate(
            async () =>
              (
                await fetch("/api/auth/logout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                })
              ).status,
          ),
        ).toBe(200);
        await participant.getByRole("button", { name: "Hand in", exact: true }).click();
        await expect(participant.getByText("Your sign-in ended.")).toBeVisible();
        await expect(participant.getByRole("button", { name: "A", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await participant.getByRole("link", { name: "Sign in", exact: true }).click();
        await participant.getByRole("textbox", { name: "Username" }).fill(NOAH.username);
        await participant.getByRole("textbox", { name: "Password" }).fill(NOAH.password);
        await participant.getByRole("button", { name: "Sign in", exact: true }).click();
        await participant.waitForURL(new RegExp(`/q/${token}`));
        await expect(participant.getByRole("button", { name: "A", exact: true })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await participant.getByRole("button", { name: "Hand in", exact: true }).click();
      if (form === "quiz") await expect(participant.getByText("Your score")).toBeVisible();
      else if (form === "survey")
        await expect(
          participant.getByRole("heading", { name: "Handed in", exact: true }),
        ).toBeVisible();
      else if (form === "relay") {
        await expect
          .poll(async () => {
            const data = await call("/live/relays/run", { run });
            return data.run.rounds[0].figure.handedIn;
          })
          .toBe(1);
        await expect(
          participant.getByRole("heading", { name: "Response received", exact: true }),
        ).toBeVisible();
      }
      expect(responseRequests.some((url) => url.endsWith("/begin-signed"))).toBe(true);
      expect(responseRequests.every((url) => url.endsWith("-signed"))).toBe(true);
      // A refused anonymous request must not clear an existing browser session.
      const sessionBefore = (await phone.cookies()).find(
        (cookie) => cookie.name === "__Host-commons-session",
      );
      expect(sessionBefore).toBeDefined();
      const authResult = await participant.evaluate(async (token) => {
        const denied = await fetch("/api/live/p/begin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, device: "stray-anonymous-request" }),
        });
        const me = await fetch("/api/auth/me", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        return { denied: denied.status, me: me.status };
      }, token);
      expect(authResult).toEqual({ denied: 401, me: 200 });
      expect(
        (await phone.cookies()).find((cookie) => cookie.name === "__Host-commons-session")?.value,
      ).toBe(sessionBefore?.value);
      responseRequests.length = 0; // Observe only UI requests again after the deliberate probe.
      await participant.reload();
      await expect(participant.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(
        0,
      );
      if (form === "quiz") {
        await expect(participant.getByText("Your score")).toBeVisible();
      } else if (form === "survey") {
        await expect(
          participant.getByRole("heading", { name: "Handed in", exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          participant.getByRole("heading", { name: "Response received", exact: true }),
        ).toBeVisible();
      }
      expect(responseRequests.every((url) => url.endsWith("-signed"))).toBe(true);
    } finally {
      releaseAuth();
      releaseArrival();
      await phone.close();
    }
  });
}
