import { expect, type APIRequestContext, type Page, test } from "@playwright/test";

const LONG_PILE =
  "Work lost during the last minutes before a technical presentation because a tool hid whether changes were saved, synchronized, or recoverable";
const OTHER_PILE = "Desires without a concrete bad situation or a clear cost";
const SCENARIOS = [
  "A laptop restarted while I was editing the final architecture diagram; the unsaved arrows disappeared and our team spent twenty minutes reconstructing which service called which endpoint.",
  "A browser tab froze during a code review, so my carefully written explanation of a concurrency bug vanished before I could send it and the reviewer merged the unsafe change.",
  "Two devices displayed different versions of my slides without telling me synchronization had stopped; I presented an old benchmark and had to correct the conclusion afterward.",
  "An editor showed a reassuring cloud icon while offline, but my new debugging notes existed only on that machine; when its battery died I could not reproduce the failing request.",
  "A notebook kernel crashed after an expensive experiment and its output had never been saved, leaving my partner unable to compare our measurements before the project deadline.",
  "The sixth scenario: a deployment console erased the recovery command when my session expired, so I spent thirty minutes finding the right backup while classmates waited to use the exercise.",
];
const DESIRE =
  "I want an AI button that fixes every software problem instantly, but I have not yet described what happened, who was affected, or which concrete cost needs preventing.";

interface Wall {
  cards: { card: string; value: string; pile: string | null }[];
  piles: { pile: string; name: string; count: number }[];
}
interface Question {
  question: string;
  parts: string[];
  choices: string[];
  context: { name: string; cards: string[] }[];
}

interface Host {
  request: APIRequestContext;
  cookie: string;
}

/** All setup uses the real edge; the phone renders the resulting captured round. */
async function call<Value>(host: Host, path: string, data: unknown): Promise<Value> {
  const response = await host.request.post(`/api${path}`, {
    data,
    headers: { Cookie: host.cookie },
  });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as Value;
}

async function questionOf(host: Host, token: string): Promise<Question> {
  const face = await call<{ relay: { questions: Question[] } }>(host, "/live/p/arrive", {
    token,
  });
  expect(face.relay.questions).toHaveLength(1);
  return face.relay.questions[0]!;
}

async function handIn(host: Host, token: string, question: string, device: string, value: string) {
  const { response } = await call<{ response: string }>(host, "/live/p/begin", {
    token,
    device,
  });
  await call(host, "/live/p/answer", { response, question, value });
  await call(host, "/live/p/submit", { response });
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")).toBe(
    true,
  );
}

test("a phone can read every source scenario after write, vote, and list, then recover its receipt", async ({
  request,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const login = await request.post("/api/auth/login", {
    data: { username: "mara", password: "password123" },
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()["set-cookie"]?.split(";")[0];
  expect(cookie).toBeTruthy();
  // Host setup passes the cookie explicitly, so participant engine coverage
  // does not depend on accepting Secure staff cookies on local plain HTTP.
  const host: Host = { request, cookie: cookie! };

  const { relay } = await call<{ relay: string }>(host, "/live/relays/plan", {
    title: "Technical frustrations: from votes to useful concepts",
  });
  const add = async (title: string, prompt: string) =>
    call<{ leg: string }>(host, "/live/relays/add-round", {
      relay,
      title,
      prompt,
      parts: [],
      choices: [],
      cap: 0,
    });
  const write = await add(
    "Recent frustrations",
    "Describe a recent technical frustration and its cost.",
  );
  const vote = await add("Choose the story", "Which group should we examine together?");
  const list = await add(
    "Find a preventive course of action",
    "For each group, refine one situation and name a coherent course of action that could prevent it.",
  );
  await call(host, "/live/relays/set-kind", { leg: vote.leg, kind: "vote" });
  await call(host, "/live/relays/set-kind", { leg: list.leg, kind: "list" });
  await call(host, "/live/relays/set-takes", { leg: vote.leg, source: write.leg, use: "choices" });
  await call(host, "/live/relays/set-takes", { leg: list.leg, source: vote.leg, use: "parts" });
  const { run, token } = await call<{ run: string; token: string }>(host, "/live/relays/launch", {
    relay,
  });
  const first = await call<{ round: string }>(host, "/live/relays/open-round", {
    run,
    leg: write.leg,
  });
  const firstQuestion = await questionOf(host, token);
  // Sequential hand-ins give an intentional display order: the sixth source
  // must remain reachable beyond the old five-response preview cutoff.
  for (const [index, value] of [...SCENARIOS, DESIRE].entries()) {
    await handIn(host, token, firstQuestion.question, `source-${index}`, value);
  }
  const wall = async (round: string) =>
    (await call<{ wall: Wall }>(host, "/live/walls/read", { round })).wall;
  await expect.poll(async () => (await wall(first.round)).cards.length).toBe(7);
  const cards = new Map((await wall(first.round)).cards.map((card) => [card.value, card.card]));
  const main = await call<{ pile: string }>(host, "/live/walls/open-pile", {
    round: first.round,
    name: LONG_PILE,
    card: cards.get(SCENARIOS[0]!),
  });
  for (const value of SCENARIOS.slice(1)) {
    await call(host, "/live/walls/move-card", { card: cards.get(value), pile: main.pile });
  }
  const desires = await call<{ pile: string }>(host, "/live/walls/open-pile", {
    round: first.round,
    name: OTHER_PILE,
    card: cards.get(DESIRE),
  });
  await call(host, "/live/relays/close-round", { round: first.round });
  for (const pile of [main.pile, desires.pile])
    await call(host, "/live/walls/pick", { round: first.round, pile });

  const voting = await call<{ round: string }>(host, "/live/relays/open-round", {
    run,
    leg: vote.leg,
  });
  const voteQuestion = await questionOf(host, token);
  expect(voteQuestion.choices).toEqual([LONG_PILE, OTHER_PILE]);
  for (const [index, value] of [LONG_PILE, LONG_PILE, OTHER_PILE].entries()) {
    await handIn(host, token, voteQuestion.question, `voter-${index}`, value);
  }
  await expect.poll(async () => (await wall(voting.round)).piles.length).toBe(2);
  await call(host, "/live/relays/close-round", { round: voting.round });
  const votePiles = (await wall(voting.round)).piles;
  for (const name of [LONG_PILE, OTHER_PILE]) {
    await call(host, "/live/walls/pick", {
      round: voting.round,
      pile: votePiles.find((pile) => pile.name === name)!.pile,
    });
  }
  await call(host, "/live/relays/open-round", { run, leg: list.leg });
  const listQuestion = await questionOf(host, token);
  expect(listQuestion.parts).toEqual([LONG_PILE, OTHER_PILE]);
  expect(listQuestion.context).toEqual([
    { name: LONG_PILE, cards: SCENARIOS },
    { name: OTHER_PILE, cards: [DESIRE] },
  ]);

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const participant = await phone.newPage();
    await participant.goto(`/q/${token}`);
    const sources = participant
      .locator("details")
      .filter({ has: participant.locator("summary", { hasText: "6 responses" }) });
    await expect(sources).toHaveCount(1);
    const summary = sources.locator("summary");
    await expect(participant.getByText(LONG_PILE, { exact: true })).toBeVisible();
    await expect(summary).toContainText("6 responses");
    // The full name wraps naturally instead of living in a clipped title.
    expect(
      await summary
        .locator("span")
        .first()
        .evaluate("(node) => getComputedStyle(node).webkitLineClamp"),
    ).not.toBe("2");
    await noHorizontalOverflow(participant);
    await expect(sources.locator("li").first()).toBeHidden();
    await summary.click();
    await expect(sources.locator("li")).toHaveCount(6);
    await expect(sources.getByText(SCENARIOS[5]!, { exact: true })).toBeVisible();
    for (const value of SCENARIOS)
      await expect(sources.getByRole("listitem").filter({ hasText: value })).toBeVisible();
    await noHorizontalOverflow(participant);
    await participant.screenshot({
      path: testInfo.outputPath("relay-source-context-phone.png"),
      fullPage: true,
    });
    await summary.click();
    await expect(sources.getByText(SCENARIOS[5]!, { exact: true })).toBeHidden();
    await summary.click();
    await expect(sources.getByText(SCENARIOS[5]!, { exact: true })).toBeVisible();

    const costBox = participant.getByRole("textbox", { name: LONG_PILE, exact: true });
    const desireBox = participant.getByRole("textbox", { name: OTHER_PILE, exact: true });
    await expect(participant.getByRole("textbox")).toHaveCount(2);
    await expect(costBox).toBeVisible();
    await expect(desireBox).toBeVisible();
    await costBox.fill(
      "Checkpointing: preserve recoverable edits before a session expires, preventing thirty minutes of recovery work.",
    );
    await desireBox.fill(
      "Ask for the situation and cost before proposing a feature; a wish alone does not identify a preventive course of action.",
    );
    await desireBox.blur();
    const submit = participant.getByRole("button", { name: "Hand in", exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(
      participant.getByRole("heading", { name: "Handed in", exact: true }),
    ).toBeVisible();
    await participant.reload();
    await expect(
      participant.getByRole("heading", { name: "Handed in", exact: true }),
    ).toBeVisible();
    await expect(participant.getByRole("button", { name: "Hand in", exact: true })).toBeHidden();
    await noHorizontalOverflow(participant);
    await participant.screenshot({
      path: testInfo.outputPath("relay-source-context-receipt.png"),
      fullPage: true,
    });
  } finally {
    await phone.close();
    await call(host, "/live/relays/close", { run });
  }
});
