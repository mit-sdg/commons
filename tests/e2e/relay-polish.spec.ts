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

async function settledPage(page: Page) {
  await page.evaluate(`new Promise(resolve => {
    let last = window.scrollY;
    let stable = 0;
    const frame = () => {
      const current = window.scrollY;
      stable = current === last ? stable + 1 : 0;
      last = current;
      if (stable >= 8) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })`);
}

test("reference selection, separate previews, and Runs navigation", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  const { document } = await call<{ document: string }>(page, "/live/drafts/give-document", {
    title: "Workshop reading",
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
  await expect(page.getByText("No reference documents selected.")).toBeVisible();
  await page.getByRole("button", { name: "Add reference" }).click();
  await page.getByRole("checkbox", { name: "Workshop reading" }).check();
  await expect
    .poll(
      async () =>
        (await call<{ references: string[] }>(page, "/live/references/get", { subject: relay }))
          .references,
    )
    .toEqual([document]);
  await page.getByRole("button", { name: "Add reference" }).click();
  await page.getByText("Response sorting", { exact: false }).first().click();
  await expect(page.getByText("Reserved piles", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Example results" }).click();
  await page.getByRole("button", { name: "Generate preview" }).click();
  await expect(page.getByText("AI-generated examples", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const example = page.getByRole("tabpanel").locator("details").first();
  await example.locator("summary").click();
  await expect(example.locator("li").first()).toBeVisible();
  await page.screenshot({ path: "/tmp/relay-polish-editor.png", fullPage: false });
  await page.getByRole("button", { name: "Remove reference Workshop reading" }).click();
  await expect(page.getByText("No reference documents selected.")).toBeVisible();
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
  await expect(page.getByText("Workshop reading", { exact: true })).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
  await page.screenshot({ path: "/tmp/relay-polish-documents-mobile.png", fullPage: false });
});

test("Resort waits for edited sorting instructions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Instruction ordering",
  });
  const { leg } = await call<{ leg: string }>(page, "/live/relays/add-round", {
    relay,
    title: "Frustrations",
    prompt: "Describe a technical frustration.",
    parts: [],
    choices: [],
    cap: 0,
  });
  const { run } = await call<{ run: string }>(page, "/live/relays/launch", { relay });
  const { round } = await call<{ round: string }>(page, "/live/relays/open-round", { run, leg });
  const standing = await call<{ run: { token: string } }>(page, "/live/relays/run", { run });
  const token = standing.run.token;
  const face = await call<{ relay: { questions: { question: string }[] } }>(
    page,
    "/live/p/arrive",
    { token },
  );
  const { response } = await call<{ response: string }>(page, "/live/p/begin", {
    token,
    device: "notes-test",
  });
  await call(page, "/live/p/answer", {
    response,
    question: face.relay.questions[0]!.question,
    value: "The app loses unsaved work",
  });
  await call(page, "/live/p/submit", { response });
  type Wall = { wall: { cards: { card: string }[] } };
  await expect
    .poll(async () => (await call<Wall>(page, "/live/walls/read", { round })).wall.cards.length)
    .toBe(1);
  const card = (await call<Wall>(page, "/live/walls/read", { round })).wall.cards[0]!.card;
  await call(page, "/live/walls/open-pile", { round, name: "Existing", card });
  await call(page, "/live/relays/sort-by-model", { run });
  await page.goto(`/staff/live/run/${run}`);
  await page.getByText("Sorting instructions", { exact: false }).first().click();
  const notes = page.getByRole("textbox", { name: "Additional instructions for this run" });
  await notes.fill("Keep desires separate from bad situations.");
  let release!: () => void;
  let saveStarted = false;
  let saved = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ordered: string[] = [];
  await page.route("**/api/live/walls/set-notes", async (route) => {
    saveStarted = true;
    await gate;
    const result = await route.fetch();
    saved = true;
    ordered.push("saved");
    await route.fulfill({ response: result });
  });
  await page.route("**/api/live/walls/empty-piles", async (route) => {
    ordered.push(saved ? "empty after save" : "empty before save");
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Resort", exact: true }).click();
    await expect.poll(() => saveStarted).toBe(true);
    await page.waitForTimeout(500);
    expect(ordered).toEqual([]);
  } finally {
    release();
  }
  await expect.poll(() => ordered).toEqual(["saved", "empty after save"]);
  await page.screenshot({ path: "/tmp/relay-polish-sorting-desktop.png", fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(notes).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  await page.screenshot({ path: "/tmp/relay-polish-sorting-mobile.png", fullPage: false });
});

test("dependent preview generates earlier rounds and expands source responses", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Dependent previews",
  });
  const legs: string[] = [];
  for (let number = 1; number <= 3; number++) {
    const { leg } = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title: `Step ${number}`,
      prompt:
        number === 1
          ? "Describe a technical frustration."
          : "Suggest an improvement to the earlier situations.",
      parts: [],
      choices: [],
      cap: 0,
    });
    if (number > 1)
      await call(page, "/live/relays/set-takes", { leg, source: legs[number - 2], use: "context" });
    legs.push(leg);
  }
  await page.goto(`/staff/live/relay/${relay}/edit`);
  await page.getByRole("textbox", { name: "Round 3 title", exact: true }).click();
  const asked: string[] = [];
  const accepted: string[] = [];
  let failedRequest: string | null = null;
  page.on("response", (response) => {
    if (!response.url().endsWith("/api/live/rounds/sample-answers")) return;
    const leg = response.request().postDataJSON().leg as string;
    if (response.ok()) accepted.push(leg);
    else failedRequest = `Sampling ${leg} returned HTTP ${response.status()}`;
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/api/live/rounds/sample-answers"))
      asked.push(request.postDataJSON().leg);
  });
  await page.getByRole("button", { name: "Generate preview", exact: true }).click();
  await expect
    .poll(
      () => {
        if (failedRequest !== null) throw new Error(failedRequest);
        return accepted;
      },
      { timeout: 180_000 },
    )
    .toEqual(legs);
  expect(asked).toEqual(legs);
  await expect(page.getByRole("tab", { name: "Example results" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.getByRole("tab", { name: "Participant view" }).click();
  const preview = page.locator('[data-preview="column"] [data-participant-frame]');
  const group = preview.locator("details").first();
  await expect(group).toBeVisible({ timeout: 90_000 });
  await group.locator("summary").click();
  await expect(group.locator("ul")).toBeVisible();
  await expect(preview.locator("textarea").first()).toBeDisabled();
  await page.screenshot({ path: "/tmp/relay-polish-preview-context.png", fullPage: false });
});

test("bounded preview picks, carry rendering, guides, and viewport reachability", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill("mara");
  await page.getByRole("textbox", { name: "Password" }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
  const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Bounded context and host guide",
  });
  const legs: string[] = [];
  for (let index = 0; index < 5; index++) {
    const { leg } = await call<{ leg: string }>(page, "/live/relays/add-round", {
      relay,
      title: `Round ${index + 1}`,
      prompt: index === 0 ? "Describe a challenge." : "Build on the selected challenges.",
      parts: [],
      choices: [],
      cap: 0,
    });
    legs.push(leg);
  }
  const source = legs[0]!;
  const followup = legs[1]!;
  await call(page, "/live/relays/set-kind", { leg: legs[3], kind: "list" });
  await call(page, "/live/relays/revise-round", {
    leg: legs[3],
    title: "Round 4",
    prompt: "Name the evidence and next step.",
    parts: ["A concrete incident and its consequence", "A useful next step"],
    choices: [],
    cap: 0,
  });
  const groupNames = Array.from(
    { length: 6 },
    (_, index) =>
      `Scenario ${index + 1} ${"A long but meaningful group label with a concrete constraint ".repeat(3)}`,
  );
  for (const name of groupNames)
    await call(page, "/live/rounds/add-pile", {
      leg: source,
      name,
      description: "Preserve the concrete example.",
    });
  await call(page, "/live/relays/set-takes", { leg: followup, source, use: "context" });
  await call(page, "/live/relays/set-guide", {
    relay,
    field: "description",
    body: "Build a shared account of challenges and possible responses.",
  });
  await call(page, "/live/rounds/set-guide", {
    leg: source,
    field: "selection",
    body: "Choose two distinct incidents for comparison.",
  });
  await page.goto(`/staff/live/relay/${relay}/edit`);
  await page.getByRole("textbox", { name: "Round 2 title", exact: true }).click();
  const preview = page.locator('[data-preview="column"]');
  await expect(preview.getByText("Round 2", { exact: true }).first()).toBeVisible();
  await preview.getByRole("button", { name: "Generate preview", exact: true }).click();
  await expect(preview.getByRole("tab", { name: "Example results" })).toHaveAttribute(
    "data-state",
    "active",
    { timeout: 90_000 },
  );
  await preview.getByRole("tab", { name: "Participant view" }).click();
  await expect(preview.getByText("Assumed picks (3)", { exact: true })).toBeVisible();
  await expect(preview.locator("[data-participant-frame] details")).toHaveCount(3);
  await preview.getByText("Assumed picks (3)", { exact: true }).click();
  await expect(preview.getByRole("checkbox")).toHaveCount(9);
  await preview.getByRole("checkbox").first().uncheck();
  await expect(preview.locator("[data-participant-frame] details")).toHaveCount(2);
  await preview.getByRole("tab", { name: "Example results" }).click();
  await expect(preview.getByText("Preview changed—refresh to see current results.")).toBeVisible();
  await preview.getByRole("tab", { name: "Participant view" }).click();
  const scroll = preview.locator("[data-preview-scroll]");
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(preview.getByRole("button", { name: "Refresh preview" })).toBeInViewport();
  await settledPage(page);
  const scrollBox = await scroll.boundingBox();
  await page.mouse.move(scrollBox!.x + 20, scrollBox!.y + 20);
  await settledPage(page);
  const scrollBefore = await page.evaluate("window.scrollY");
  await page.mouse.wheel(0, 900);
  await settledPage(page);
  expect(await page.evaluate("window.scrollY")).toBe(scrollBefore);
  await expect(preview.getByText("Round 2", { exact: true }).first()).toBeVisible();
  const actionBox = await preview.getByRole("button", { name: "Refresh preview" }).boundingBox();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: testInfo.outputPath("preview-desktop-overflow.png") });
  await call(page, "/live/relays/set-takes", { leg: followup, source, use: "parts" });
  await page.reload();
  await page.getByRole("textbox", { name: "Round 2 title", exact: true }).click();
  await expect(preview.locator("[data-participant-frame] textarea")).toHaveCount(3);
  await expect(
    preview.locator("[data-participant-frame]").getByText("From an earlier round", { exact: true }),
  ).toHaveCount(0);
  await expect(
    preview.locator("[data-participant-frame]").getByText("Supporting responses", { exact: true }),
  ).toHaveCount(3);
  await call(page, "/live/relays/set-takes", { leg: followup, source, use: "choices" });
  await page.reload();
  await page.getByRole("textbox", { name: "Round 2 title", exact: true }).click();
  await expect(preview.locator("[data-participant-frame] button[aria-pressed]")).toHaveCount(3);
  await expect(preview.locator("[data-participant-frame] textarea")).toHaveCount(0);
  await expect(preview.locator("[data-participant-frame]")).not.toContainText("Assumed picks");
  await expect(preview.locator("[data-participant-frame]")).not.toContainText("AI-generated");
  await page.getByText("Description and host guide", { exact: true }).click();
  const opening = page.getByRole("textbox", { name: "Opening", exact: true });
  await opening.fill("Invite one concrete incident from each person.");
  await opening.blur();
  await expect
    .poll(
      async () =>
        (
          await call<{ relay: { hostGuide: { opening: string } } }>(page, "/live/relays/get", {
            relay,
          })
        ).relay.hostGuide.opening,
    )
    .toBe("Invite one concrete incident from each person.");
  await page.setViewportSize({ width: 1024, height: 650 });
  await page.getByRole("textbox", { name: "Round 2 title", exact: true }).click();
  await expect(preview.getByRole("button", { name: "Refresh preview" })).toBeInViewport();
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("preview-constrained.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("textbox", { name: "Round 2 title", exact: true }).click();
  await page.getByText("Preview round 2", { exact: true }).click();
  const drawer = page.locator('[data-preview="drawer"]');
  await expect(drawer.locator("[data-participant-frame] button[aria-pressed]")).toHaveCount(3);
  await drawer.getByRole("button", { name: "Refresh preview" }).scrollIntoViewIfNeeded();
  await expect(drawer.getByRole("button", { name: "Refresh preview" })).toBeInViewport();
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("preview-mobile.png") });
  const partLabel = page.getByRole("textbox", { name: "Round 4 part 1", exact: true });
  await partLabel.scrollIntoViewIfNeeded();
  expect((await partLabel.boundingBox())!.width).toBeGreaterThan(280);
  expect(await partLabel.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  await expect(page.getByRole("button", { name: "Remove round 4 part 1", exact: true })).toHaveCSS(
    "opacity",
    "1",
  );
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("part-label-mobile.png") });
  await page.goto(`/staff/live/relay/${relay}`);
  await page.getByText("Session host guide", { exact: true }).click();
  await expect(
    page.getByText("Invite one concrete incident from each person.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Launch", exact: true }).click();
  await page.waitForURL("**/staff/live/run/**");
  await page.getByText("Session host guide", { exact: true }).click();
  await expect(
    page.getByText("Invite one concrete incident from each person.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("document.documentElement.scrollWidth <= innerWidth")).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("host-guide-mobile.png") });
});
