import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { placingPassage, wallCardIds } from "../../src/computations/live-walls.ts";

type Edge = ReturnType<typeof createEdge>;

const post = (edge: Edge, path: string, body: unknown, cookie?: string) =>
  edge.fetch(
    new Request(`http://edge/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const json = async (response: Response) => (await response.json()) as Record<string, never>;

async function registerHost(edge: Edge) {
  const registered = await edge.application.concepts.Authenticating.register({
    username: "nadia",
    password: "pw-nadia-123",
    email: "nadia@example.com",
  });
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: "Nadia",
  });
  const { role } = await edge.application.concepts.Roling.ensureRole({
    name: "live-host",
    capabilities: ["live:host"],
  });
  await edge.application.concepts.Roling.assign({
    user: registered.user,
    context: "commons",
    role,
  });
  const login = await post(edge, "/auth/login", {
    username: "nadia",
    password: "pw-nadia-123",
  });
  return {
    user: registered.user,
    cookie: login.headers.get("Set-Cookie")?.split(";")[0] as string,
  };
}

async function until<Value>(read: () => Promise<Value>, done: (value: Value) => boolean) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await read();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return read();
}

afterAll(stopTestDb);

/** What the brief can tell apart: the round's trashed cards, or every trashed item there is. */
test("the round's trashed subset writes the same brief as the whole trash", async () => {
  const edge = createEdge(mongoImplementations(await testDb()));
  const { user, cookie } = await registerHost(edge);
  const call = async (path: string, body: unknown) => json(await post(edge, path, body, cookie));

  const { relay } = await call("/live/relays/plan", { title: "Subset" });
  const legs: string[] = [];
  for (const title of ["One", "Two"]) {
    const added = await call("/live/relays/add-round", {
      relay,
      title,
      prompt: `${title}?`,
      parts: [],
      cap: 0,
      choices: [],
    });
    legs.push(added.leg as string);
  }
  const launched = await call("/live/relays/launch", { relay });
  const run = launched.run as string;
  const token = launched.token as string;

  const handIn = async (value: string) => {
    const face = await until(
      async () =>
        (await json(await post(edge, "/live/p/arrive", { token }))).relay as unknown as {
          openRound: string | null;
          questions: { question: string }[];
        },
      (found) => found.openRound !== null && found.questions.length > 0,
    );
    const { response } = await call("/live/p/begin", { token, device: `phone-${value}` });
    await call("/live/p/answer", { response, question: face.questions[0]!.question, value });
    await call("/live/p/submit", { response });
  };
  const wallOf = async (round: string, count: number) =>
    (
      await until(
        async () =>
          (await call("/live/walls/read", { round })).wall as unknown as {
            cards: { card: string }[];
          },
        (wall) => wall.cards.length === count,
      )
    ).cards;

  const round = (await call("/live/relays/open-round", { run, leg: legs[0]! })).round as string;
  for (const value of ["keep", "share", "send"]) await handIn(value);
  const cards = await wallOf(round, 3);
  await call("/live/walls/open-pile", { round, name: "keeping", card: cards[0]!.card });
  const ours = (await call("/live/walls/remove-card", { round, card: cards[2]!.card }))
    .card as string;
  await call("/live/relays/close-round", { round });

  const other = (await call("/live/relays/open-round", { run, leg: legs[1]! })).round as string;
  for (const value of ["later", "again"]) await handIn(value);
  const theirs = (
    await call("/live/walls/remove-card", {
      round: other,
      card: (await wallOf(other, 2))[1]!.card,
    })
  ).card as string;

  const foreign = "an-item-of-no-round";
  await edge.application.concepts.Trashing.trash({ item: foreign, by: user, at: new Date() });

  const concepts = edge.application.concepts;
  const { values } = await concepts.Responding._valuesForSubject({ subject: round });
  const { categories } = await concepts.Categorizing._categoriesWithItems({ scope: round });
  const { items: everything } = await concepts.Trashing._trashedItems({});
  const { trashed: subset } = await concepts.Trashing._trashedAmong({
    items: wallCardIds({ values, categories }),
  });
  const value = (await concepts.RunSnapshotting._snapshot({ subject: round }))[0]!.value;
  const brief = (removed: string[]) =>
    placingPassage({ value, categories, values, removed, notes: "" });

  expect(subset).toEqual([ours]);
  expect(everything).toHaveLength(3);
  expect(everything).toEqual(expect.arrayContaining([ours, theirs, foreign]));
  expect(brief(subset)).toBe(brief(everything));
}, 120_000);
