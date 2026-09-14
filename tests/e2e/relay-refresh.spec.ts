import { expect, type Page, test } from "@playwright/test";

const CHOICE = "Recoverable edits";
const SOURCES = ["Save a local draft", "Recover after a restart", "Keep earlier versions"];

type Wall = {
  cards: { card: string; value: string }[];
  piles: { pile: string; name: string }[];
};

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

for (const surface of ["dashboard", "projector"] as const) {
  test(`${surface} retains expanded source responses during relay refresh and receives configuration changes`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Username" }).fill("mara");
    await page.getByRole("textbox", { name: "Password" }).fill("password123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/");

    const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", {
      title: `Refresh continuity ${surface}`,
    });
    const add = (title: string) =>
      call<{ leg: string }>(page, "/live/relays/add-round", {
        relay,
        title,
        prompt: title,
        parts: [],
        choices: [],
        cap: 0,
      });
    const write = await add("Suggest improvements");
    const vote = await add("Choose an improvement");
    const next = await add("Describe the next step");
    await call(page, "/live/relays/set-kind", { leg: vote.leg, kind: "vote" });
    await call(page, "/live/relays/set-takes", {
      leg: vote.leg,
      source: write.leg,
      use: "choices",
    });
    const { run } = await call<{ run: string }>(page, "/live/relays/launch", {
      relay,
    });
    try {
      const standing = await call<{ run: { token: string } }>(page, "/live/relays/run", { run });
      const token = standing.run.token;
      const handIn = async (value: string, device: string) => {
        const face = await call<{
          relay: { questions: { question: string }[] };
        }>(page, "/live/p/arrive", { token });
        const { response } = await call<{ response: string }>(page, "/live/p/begin", {
          token,
          device,
        });
        await call(page, "/live/p/answer", {
          response,
          question: face.relay.questions[0]!.question,
          value,
        });
        await call(page, "/live/p/submit", { response });
      };
      const wallOf = async (round: string) =>
        (await call<{ wall: Wall }>(page, "/live/walls/read", { round })).wall;
      const first = await call<{ round: string }>(page, "/live/relays/open-round", {
        run,
        leg: write.leg,
      });
      for (const [index, value] of SOURCES.entries()) await handIn(value, `source-${index}`);
      await expect.poll(async () => (await wallOf(first.round)).cards.length).toBe(3);
      const cards = (await wallOf(first.round)).cards;
      const { pile } = await call<{ pile: string }>(page, "/live/walls/open-pile", {
        round: first.round,
        name: CHOICE,
        card: cards[0]!.card,
      });
      for (const card of cards.slice(1))
        await call(page, "/live/walls/move-card", { card: card.card, pile });
      await call(page, "/live/relays/close-round", { round: first.round });
      await call(page, "/live/walls/pick", { round: first.round, pile });
      const voting = await call<{ round: string }>(page, "/live/relays/open-round", {
        run,
        leg: vote.leg,
      });
      await handIn(CHOICE, "voter");
      await expect.poll(async () => (await wallOf(voting.round)).piles.length).toBe(1);
      await call(page, "/live/relays/close-round", { round: voting.round });
      await call(page, "/live/walls/pick", {
        round: voting.round,
        pile: (await wallOf(voting.round)).piles[0]!.pile,
      });

      await page.goto(`/staff/live/run/${run}${surface === "projector" ? "/project" : ""}`);
      await page
        .getByRole("button", {
          name: `View supporting responses in ${CHOICE}`,
          exact: true,
        })
        .click();
      const panel = page.getByRole("region", {
        name: `${CHOICE}, every card`,
        exact: true,
      });
      await expect(panel.getByRole("listitem")).toHaveCount(3);
      await expect(panel.getByText("3 supporting responses", { exact: true })).toBeVisible();
      const carry = page.getByRole("img", {
        name: "carries into round 3",
        exact: true,
      });
      await expect(carry).toHaveCount(0);
      await expect(page.getByText("1 vote", { exact: true })).toBeVisible();

      // Hold a real relay response across another run poll. Eventual assertions
      // after the response arrives would miss the disappearing source cards.
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const intercepted = new Promise<void>((resolve) => {
        entered = resolve;
      });
      await page.route("**/api/live/relays/get", async (route) => {
        entered();
        await held;
        await route.continue();
      });
      try {
        await intercepted;
        await call(page, "/live/relays/set-takes", {
          leg: next.leg,
          source: vote.leg,
          use: "context",
        });
        await page.waitForResponse("**/api/live/relays/run");
        await expect(panel.getByRole("listitem")).toHaveCount(3);
        for (const value of SOURCES)
          await expect(panel.getByText(value, { exact: true })).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: `Hide supporting responses in ${CHOICE}`,
            exact: true,
          }),
        ).toHaveAttribute("aria-expanded", "true");
        await expect(carry).toHaveCount(0);
      } finally {
        release();
      }
      await expect(carry).toBeVisible();
      await expect(panel.getByRole("listitem")).toHaveCount(3);
      await page.unrouteAll({ behavior: "wait" });

      let releaseSource!: () => void;
      const sourceHeld = new Promise<void>((resolve) => {
        releaseSource = resolve;
      });
      let sourceEntered!: () => void;
      const sourceIntercepted = new Promise<void>((resolve) => {
        sourceEntered = resolve;
      });
      await page.route("**/api/live/walls/read", async (route) => {
        if (route.request().postDataJSON().round === first.round) {
          sourceEntered();
          await sourceHeld;
        }
        await route.continue();
      });
      try {
        await sourceIntercepted;
        await call(page, "/live/walls/to-tray", { card: cards[0]!.card });
        await page.waitForResponse("**/api/live/relays/run");
        await expect(panel.getByRole("listitem")).toHaveCount(3);
      } finally {
        releaseSource();
      }
      await expect(panel.getByRole("listitem")).toHaveCount(2);
      await expect(panel.getByText("2 supporting responses", { exact: true })).toBeVisible();
      await expect(page.getByText("1 vote", { exact: true })).toBeVisible();
      await expect(panel.getByText(cards[0]!.value, { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", {
          name: `Hide supporting responses in ${CHOICE}`,
          exact: true,
        }),
      ).toHaveAttribute("aria-expanded", "true");
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await call(page, "/live/relays/close", { run });
    }
  });
}
