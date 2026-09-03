import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

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
  const host = {
    username: "lee",
    password: "pw-lee-123",
    displayName: "Professor Lee",
    email: "lee@example.com",
  };
  const registered = await edge.application.concepts.Authenticating.register(host);
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: host.displayName,
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
    username: host.username,
    password: host.password,
  });
  return login.headers.get("Set-Cookie")?.split(";")[0] as string;
}

describe("retiring a relay", () => {
  let edge: Edge;
  let cookie: string;

  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    cookie = await registerHost(edge);
  });

  afterAll(stopTestDb);

  test("a relay retires once its run has closed, and is then refused a launch", async () => {
    const planned = await json(await post(edge, "/live/relays/plan", { title: "Warm-up" }, cookie));
    const relay = planned.relay as string;
    await post(
      edge,
      "/live/relays/add-round",
      { relay, title: "One word", prompt: "One word.", parts: [], cap: 0, choices: [] },
      cookie,
    );
    const launched = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    const run = launched.run as string;

    const whileOpen = await json(await post(edge, "/live/relays/retire", { relay }, cookie));
    expect(whileOpen.error).toBe("CONFLICT");

    await post(edge, "/live/relays/close", { run }, cookie);
    const retired = await json(await post(edge, "/live/relays/retire", { relay }, cookie));
    expect(retired.relay).toBe(relay);

    const again = await json(await post(edge, "/live/relays/retire", { relay }, cookie));
    expect(again.error).toBe("CONFLICT");

    const relaunch = await json(await post(edge, "/live/relays/launch", { relay }, cookie));
    expect(relaunch.error).toBe("CONFLICT");

    const list = await json(await post(edge, "/live/relays/list", {}, cookie));
    const listed = (list.relays as { relay: string; retired: boolean; runs: number }[]).find(
      (entry) => entry.relay === relay,
    );
    expect(listed?.retired).toBe(true);
    expect(listed?.runs).toBe(1);

    const whole = await json(await post(edge, "/live/relays/get", { relay }, cookie));
    expect((whole.relay as { retired: boolean }).retired).toBe(true);
  });

  test("a relay nobody planned cannot be retired", async () => {
    const missing = await json(await post(edge, "/live/relays/retire", { relay: "nope" }, cookie));
    expect(missing.error).toBe("NOT_FOUND");
  });
});
