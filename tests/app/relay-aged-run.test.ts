import { afterAll, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

interface PhoneRead {
  relay: {
    open: boolean;
    openRound: string | null;
    questions: { question: string }[];
  };
}

test("a run survives two hours of waiting-room polls before its first round", async () => {
  let at = Date.now();
  const db = await testDb();
  const edge = createEdge(mongoImplementations(db), undefined, () => new Date(at));
  const other = createEdge(mongoImplementations(db), undefined, () => new Date(at));
  const host = await edge.application.concepts.Authenticating.register({
    username: "aged-host",
    password: "password123",
    email: "aged@example.com",
  });
  const { role } = await edge.application.concepts.Roling.ensureRole({
    name: "live-host",
    capabilities: ["live:host"],
  });
  await edge.application.concepts.Roling.assign({ user: host.user, context: "commons", role });
  let cookie = "";
  async function call<T = unknown>(path: string, body: unknown): Promise<T> {
    const response = await edge.fetch(
      new Request(`http://edge/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(body),
      }),
    );
    cookie = response.headers.get("Set-Cookie")?.split(";")[0] ?? cookie;
    const result = (await response.json()) as T & { error?: string };
    expect(response.ok, path).toBe(true);
    expect(result.error, path).toBeUndefined();
    return result;
  }
  await call("/auth/login", { username: "aged-host", password: "password123" });
  const { relay } = await call<{ relay: string }>("/live/relays/plan", {
    title: "Opened before class",
  });
  const { leg } = await call<{ leg: string }>("/live/relays/add-round", {
    relay,
    title: "First",
    prompt: "Your idea?",
    parts: [],
    choices: [],
    cap: 0,
  });
  const { run, token } = await call<{ run: string; token: string }>("/live/relays/launch", {
    relay,
  });
  const otherPhone = async () =>
    (
      await other.fetch(
        new Request("http://edge/api/live/p/arrive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }),
      )
    ).json() as Promise<PhoneRead>;
  expect((await otherPhone()).relay.openRound).toBeNull();
  // Exercise both elapsed application time and the actual number of requests;
  // merely changing openedAt would miss cache/history accumulation.
  for (let poll = 0; poll < 2_400; poll += 1) {
    const { relay: waiting } = await call<PhoneRead>("/live/p/arrive", { token });
    expect(waiting.openRound).toBeNull();
    expect(waiting.open).toBe(true);
    at += 3_000;
  }
  const { round } = await call<{ round: string }>("/live/relays/open-round", { run, leg });
  const { run: dashboard } = await call<{ run: { openRound: string | null } }>("/live/relays/run", {
    run,
  });
  const { relay: phone } = await call<PhoneRead>("/live/p/arrive", { token });
  expect(dashboard.openRound).toBe(round);
  expect(phone.openRound).toBe(round);
  expect((await otherPhone()).relay.openRound).toBe(round);
  const { response } = await call<{ response: string }>("/live/p/begin", {
    token,
    device: "early-phone",
  });
  await call("/live/p/answer", {
    response,
    question: phone.questions[0]!.question,
    value: "Still here",
  });
  await call("/live/p/submit", { response });
  const { wall } = await call<{ wall: { cards: { value: string }[] } }>("/live/p/wall", {
    response,
  });
  expect(wall.cards.some((card: { value: string }) => card.value === "Still here")).toBe(true);
}, 120_000);
