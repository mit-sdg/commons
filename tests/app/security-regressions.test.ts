import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

const post = (
  edge: ReturnType<typeof createEdge>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  edge.fetch(
    new Request(`http://commons.test/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );

afterAll(stopTestDb);

describe("security regressions", () => {
  test("rejects MongoDB operators before they reach any endpoint", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const response = await edge.application.concepts.Responding.begin({
      participant: "anonymous-device",
      subject: "run",
      at: new Date(),
    });

    for (const [path, body] of [
      ["/live/p/arrive", { token: { $ne: null } }],
      ["/live/p/submit", { response: { $ne: null } }],
    ] as const) {
      const rejected = await post(edge, path, body);
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toEqual({ error: "INVALID_REQUEST" });
    }
    expect(await edge.application.concepts.Responding._response(response)).toMatchObject([
      { submitted: false },
    ]);
  });

  test("a signed response accepts only its account's session", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const victim = await edge.application.concepts.Authenticating.register({
      username: "live_victim",
      password: "password123",
      email: "victim@example.edu",
    });
    const attacker = await edge.application.concepts.Authenticating.register({
      username: "live_attacker",
      password: "password123",
      email: "attacker@example.edu",
    });
    const attackerSession = await edge.application.concepts.Sessioning.start({
      user: attacker.user,
      at: new Date(),
    });
    const response = await edge.application.concepts.Responding.begin({
      participant: victim.user,
      subject: "run",
      at: new Date(),
    });

    const cookie = `__Host-commons-session=${attackerSession.session}`;
    for (const [path, body] of [
      ["/live/p/answer-signed", { ...response, question: "question", value: "stolen" }],
      ["/live/p/submit-signed", response],
      ["/live/p/outcome-signed", response],
    ] as const) {
      expect((await post(edge, path, body, { Cookie: cookie })).status).toBe(404);
    }
    const anonymous = await post(edge, "/live/p/submit", response);
    expect(anonymous.status).toBe(404);
    expect(await edge.application.concepts.Responding._response(response)).toMatchObject([
      { participant: victim.user, submitted: false },
    ]);
  });
});
