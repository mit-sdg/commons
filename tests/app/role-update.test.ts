import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

const post = async (
  edge: ReturnType<typeof createEdge>,
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
) => {
  const response = await edge.fetch(
    new Request(`http://commons.test/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
};

const register = async (edge: ReturnType<typeof createEdge>, username: string) => {
  const app = edge.application;
  const made = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email: `${username}@example.edu`,
  });
  await app.concepts.Profiling.createProfile({ user: made.user, displayName: username });
  const login = await post(edge, "/auth/login", { username, password: "password123" });
  return { user: made.user, cookie: login.cookie as string };
};

test("an administrator changes what a role carries and every holder gains it at once", async () => {
  const edge = createEdge(mongoImplementations(await testDb()));
  const admin = await register(edge, "mara");
  const helper = await register(edge, "hana");

  const defined = await post(
    edge,
    "/roles/define",
    { name: "teaching assistant", capabilities: ["grade"] },
    admin.cookie,
  );
  const role = defined.body.role as string;
  await post(edge, "/roles/assign", { user: "hana", context: "commons", role }, admin.cookie);

  expect(
    await post(edge, "/roles/update", { role, capabilities: ["grade"] }, helper.cookie),
  ).toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
  expect(
    await post(edge, "/roles/update", { role, capabilities: ["fly"] }, admin.cookie),
  ).toMatchObject({ status: 400, body: { error: "INVALID_REQUEST" } });
  expect(
    await post(edge, "/roles/update", { role: "nobody", capabilities: ["grade"] }, admin.cookie),
  ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
  expect(
    await post(
      edge,
      "/roles/update",
      { role: "administrator", capabilities: ["grade"] },
      admin.cookie,
    ),
  ).toMatchObject({ status: 409, body: { error: "CONFLICT" } });

  expect(
    await post(
      edge,
      "/roles/update",
      { role: "teaching assistant", capabilities: ["grade", "moderate"] },
      admin.cookie,
    ),
  ).toMatchObject({ status: 200, body: { role } });
  expect(
    (await post(edge, "/roles/forUser", { user: "hana", context: "commons" }, admin.cookie)).body,
  ).toMatchObject({ role, name: "teaching assistant", capabilities: ["grade", "moderate"] });
  expect((await post(edge, "/roles/list", {}, admin.cookie)).body).toMatchObject({
    roles: [
      { name: "administrator", capabilities: ["administer"] },
      { role, capabilities: ["grade", "moderate"] },
    ],
  });
});
