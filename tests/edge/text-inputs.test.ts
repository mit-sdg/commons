import { afterAll, expect, test } from "vite-plus/test";
import { hasTextWriteInputs } from "../../src/assembly/security.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

const writes = [
  ["/auth/accept-invitation", ["username", "displayName"]],
  ["/setup/register-admin", ["username", "displayName"]],
  ["/profiles/setDisplayName", ["displayName"]],
  ["/profiles/setBio", ["bio"]],
  ["/profiles/setAvatar", ["avatar"]],
  ["/threads/create", ["content"]],
  ["/threads/reply", ["content"]],
  ["/posts/edit", ["content"]],
  ["/assignments/submit", ["content"]],
  ["/tags/create", ["name"]],
  ["/reactions/add", ["kind"]],
  ["/flags/raise", ["reason"]],
  ["/tasklists/create", ["title"]],
  ["/tasklists/rename", ["title"]],
  ["/tasks/create", ["title", "details"]],
  ["/tasks/describe", ["title", "details"]],
] as const;

test("stored text inputs reject non-text values but preserve empty strings and defaults", () => {
  for (const [path, fields] of writes) {
    expect(hasTextWriteInputs(path, {})).toBe(true);
    for (const field of fields) {
      for (const value of [null, 0, false, [], {}]) {
        expect(hasTextWriteInputs(path, { [field]: value })).toBe(false);
      }
      for (const value of ["", "Plain text", "# Markdown\n\nText"]) {
        expect(hasTextWriteInputs(path, { [field]: value })).toBe(true);
      }
    }
  }
  expect(hasTextWriteInputs("/live/p/answer", { value: "Answer" })).toBe(true);
  expect(hasTextWriteInputs("/profiles/setBio", null)).toBe(false);
  expect(hasTextWriteInputs("/profiles/setBio", [])).toBe(false);
});

test("the HTTP edge refuses invalid profile changes before saving them", async () => {
  const edge = createEdge(mongoImplementations(await testDb()));
  for (const [path] of writes) expect(edge.servedPaths.has(path)).toBe(true);
  const { user } = await edge.application.concepts.Authenticating.register({
    username: "alice",
    password: "password123",
    email: "alice@example.edu",
  });
  await edge.application.concepts.Profiling.createProfile({ user, displayName: "Alice" });
  const { session } = await edge.application.concepts.Sessioning.start({ user, at: new Date() });
  const change = (displayName: unknown) =>
    edge.fetch(
      new Request("http://commons.test/api/profiles/setDisplayName", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__Host-commons-session=${session}`,
        },
        body: JSON.stringify({ displayName }),
      }),
    );
  const rejected = await change({});
  expect(rejected.status).toBe(400);
  expect(await rejected.json()).toEqual({ error: "INVALID_REQUEST" });
  expect(await edge.application.concepts.Profiling._getProfileFields({ user })).toEqual([
    { displayName: "Alice", bio: "", avatar: "" },
  ]);
  expect((await change("Alicia")).status).toBe(200);
  expect(await edge.application.concepts.Profiling._getProfileFields({ user })).toMatchObject([
    { displayName: "Alicia" },
  ]);
});
