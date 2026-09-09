import { expect, test } from "bun:test";
import { createProfileCache } from "./profile-cache";

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

test("a page shares bounded identity batches and remembers omitted profiles", async () => {
  const calls: string[][] = [];
  const cache = createProfileCache(
    async (users) => {
      calls.push(users);
      return users
        .filter((user) => user !== "missing")
        .map((user) => ({ user, displayName: user, avatar: "" }));
    },
    () => {},
  );
  for (let n = 0; n < 130; n++) {
    cache.ensure(String(n));
    cache.ensure(String(n));
  }
  cache.ensure("missing");
  for (let n = 0; n < 3; n++) await nextTurn();
  expect(calls.map((users) => users.length)).toEqual([64, 64, 3]);
  expect(cache.get("129")).toEqual({ displayName: "129", avatar: "" });
  cache.ensure("missing");
  cache.ensure("129");
  await nextTurn();
  expect(calls).toHaveLength(3);
  cache.clear();
});

test("clearing an account scope discards pending and late identity responses", async () => {
  let finish!: (
    rows: { user: string; displayName: string; avatar: string }[],
  ) => void;
  let changes = 0;
  const cache = createProfileCache(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {
      changes += 1;
    },
  );
  cache.ensure("former-account");
  await nextTurn();
  cache.ensure("not-yet-requested");
  cache.clear();
  finish([
    { user: "former-account", displayName: "Private identity", avatar: "" },
  ]);
  await nextTurn();
  expect(cache.get("former-account")).toBeUndefined();
  expect(changes).toBe(0);
});

test("failed batches can be requested again without automatic retry loops", async () => {
  let calls = 0;
  const cache = createProfileCache(
    async (users) => {
      calls += 1;
      if (calls === 1) throw new Error("Connection reset");
      return users.map((user) => ({ user, displayName: user, avatar: "" }));
    },
    () => {},
  );
  cache.ensure("reader");
  await nextTurn();
  await nextTurn();
  expect(calls).toBe(1);
  cache.ensure("reader");
  await nextTurn();
  expect(cache.get("reader")?.displayName).toBe("reader");
  cache.clear();
});
