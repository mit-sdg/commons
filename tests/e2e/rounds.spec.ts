import { expect, type Page, test } from "@playwright/test";

/**
 * The relay room, end to end, against the real stack with the scripted
 * reasoner: a two-round relay written and launched; round one answered by
 * forty scripted phones and one model participant; sorted by the model, with
 * one unusable reply stood upon and repaired; three piles picked; round two
 * opened with those piles as its choices; the run closed; the wall read back.
 */

const HOST = { username: "mara", password: "password123" };
const PHONES = 40;
const WORDS = ["add", "save", "keep", "see", "open", "visit", "delete", "remove", "forget"];

async function signIn(page: Page, account = HOST) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Username" }).fill(account.username);
  await page.getByRole("textbox", { name: "Password" }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/");
}

/** Calls the edge as the page's signed-in host; the cookie is passed by hand. */
async function call<Value>(page: Page, path: string, data: unknown): Promise<Value> {
  const cookies = await page.context().cookies();
  const cookie = cookies.map((entry) => `${entry.name}=${entry.value}`).join("; ");
  const response = await page.request.post(`/api${path}`, {
    data,
    headers: cookie === "" ? {} : { Cookie: cookie },
  });
  return (await response.json()) as Value;
}

/** Poll a read until it settles into the expected shape. */
async function until<Value>(
  read: () => Promise<Value>,
  done: (value: Value) => boolean,
  tries = 60,
): Promise<Value> {
  let value = await read();
  for (let attempt = 0; attempt < tries && !done(value); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    value = await read();
  }
  return value;
}

interface Face {
  relay: {
    openRound: string | null;
    questions: {
      question: string;
      choices: string[];
      parts: string[];
      context: { name: string }[];
    }[];
  } | null;
}

interface WallRead {
  wall: {
    cards: { value: string; pile: string | null; model: boolean }[];
    piles: { pile: string; name: string; count: number; picked: string | null }[];
  } | null;
}

test("a relay runs its room: forty phones, a model participant, sorting, picks, round two", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signIn(page);

  // Write the two-round relay through the same requests its edit page sends,
  // then launch it from that page.
  const planned = await call<{ relay: string }>(page, "/live/relays/plan", {
    title: "Three verbs, then a stranger",
  });
  const first = await call<{ leg: string }>(page, "/live/relays/add-round", {
    relay: planned.relay,
    title: "Three verbs",
    prompt: "Three verbs a bookmark needs.",
    parts: ["one", "two", "three"],
    cap: 0,
    choices: [],
  });
  const second = await call<{ leg: string }>(page, "/live/relays/add-round", {
    relay: planned.relay,
    title: "The stranger",
    prompt: "Only these verbs. What is it?",
    parts: ["answer"],
    cap: 0,
    choices: [],
  });
  await call(page, "/live/relays/set-takes", {
    leg: second.leg,
    source: first.leg,
    shape: "context",
  });
  await page.goto(`/staff/live/relay/${planned.relay}/edit`);
  await expect(page.getByRole("textbox", { name: "Title" }).nth(2)).toHaveValue("The stranger");
  await page.getByRole("button", { name: "Launch" }).click();
  await page.waitForURL(/\/staff\/live\/run\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const run = page.url().split("/").pop() as string;

  const standing = await call<{ run: { token: string; code: string } }>(page, "/live/relays/run", {
    run,
  });
  if (standing.run === undefined || standing.run === null)
    throw new Error(`run read: ${JSON.stringify(standing)}`);
  const { token, code } = standing.run;
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

  // Open round one from the dashboard.
  await page.getByRole("button", { name: /^Open.*Three verbs/ }).click();
  const face = await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound !== null && (value.relay?.questions.length ?? 0) > 0,
  );
  const roundOne = face.relay?.openRound as string;
  const question = face.relay?.questions[0]?.question as string;
  expect(face.relay?.questions[0]?.parts).toEqual(["one", "two", "three"]);

  // Forty scripted phones hand in three verbs each; one writes something unsortable.
  for (let seat = 0; seat < PHONES; seat += 1) {
    const begun = await call<{ response: string }>(page, "/live/p/begin", {
      token,
      device: `phone-${seat}`,
    });
    for (let part = 1; part <= 3; part += 1) {
      const value =
        seat === 0 && part === 1
          ? "an unsortable scribble"
          : (WORDS[(seat * 3 + part) % WORDS.length] as string);
      await call(page, "/live/p/answer", {
        response: begun.response,
        question: `${question}#${part}`,
        value,
      });
    }
    await call(page, "/live/p/submit", { response: begun.response });
  }
  const handedIn = await until(
    () =>
      call<{ wall: { handedIn: number } | null }>(page, "/live/walls/read", { round: roundOne }),
    (value) => value.wall?.handedIn === PHONES,
  );
  expect(handedIn.wall?.handedIn).toBe(PHONES);

  // One model participant, invited from the dashboard, hands in on its own clock.
  await page.getByRole("textbox", { name: "Seats to invite" }).fill("1");
  await page.getByRole("button", { name: "Invite" }).click();
  const withModel = await until(
    () => call<WallRead>(page, "/live/walls/read", { round: roundOne }),
    (value) => (value.wall?.cards.filter((card) => card.model).length ?? 0) === 3,
  );
  expect(withModel.wall?.cards.filter((card) => card.model)).toHaveLength(3);

  // The model sorts: the first reply is unusable and stood upon; the repair places everything.
  await page.getByRole("switch", { name: "Model sorts" }).click();
  const sorted = await until(
    () => call<WallRead>(page, "/live/walls/read", { round: roundOne }),
    (value) =>
      (value.wall?.cards.length ?? 0) === PHONES * 3 + 3 &&
      (value.wall?.cards.every((card) => card.pile !== null) ?? false),
    90,
  );
  expect(sorted.wall?.cards.every((card) => card.pile !== null)).toBe(true);
  const names = (sorted.wall?.piles ?? []).map((pile) => pile.name).sort();
  expect(names).toEqual(["Examples", "Pace", "Questions"]);
  await expect(page.getByText("Pace", { exact: true }).first()).toBeVisible();

  // Close round one. The pick control's default, the top four, picks all three
  // piles at once; a tap on a pile hands the pick over and unpicks that one.
  await page.getByRole("button", { name: /^Close.*Three verbs/ }).click();
  await expect(page.getByRole("button", { name: /^Open.*The stranger.*3 piles/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /^Pace\b/ }).click();
  await expect(page.getByRole("button", { name: /^Open.*The stranger.*2 piles/ })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /^Pace\b/ }).click();
  await expect(page.getByRole("button", { name: /^Open.*The stranger.*3 piles/ })).toBeEnabled({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /^Open.*The stranger/ }).click();
  const roundTwo = await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound !== null && value.relay?.openRound !== roundOne,
  );
  const shown = roundTwo.relay?.questions[0];
  expect(shown?.choices).toEqual([]);
  expect((shown?.context ?? []).map((group) => group.name).sort()).toEqual([
    "Examples",
    "Pace",
    "Questions",
  ]);

  // Close the run; the wall of round one reads back with its piles and counts.
  await page.getByRole("button", { name: "Close run", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close run", exact: true })
    .first()
    .click();
  const closed = await until(
    () => call<Face>(page, "/live/p/arrive", { token }),
    (value) => value.relay?.openRound === null,
  );
  expect(closed.relay?.openRound).toBeNull();
  const wall = await call<WallRead>(page, "/live/walls/read", { round: roundOne });
  const counted = (wall.wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
  expect(counted).toBe(PHONES * 3 + 3);
  expect((wall.wall?.piles ?? []).filter((pile) => pile.picked !== null)).toHaveLength(3);
});
