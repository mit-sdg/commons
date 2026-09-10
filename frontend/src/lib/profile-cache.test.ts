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
        .map((user) => ({
          user,
          displayName: user,
          avatar: "",
          role: { name: null },
        }));
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
  expect(cache.get("129")).toEqual({
    displayName: "129",
    avatar: "",
    role: { name: null },
  });
  cache.ensure("missing");
  cache.ensure("129");
  await nextTurn();
  expect(calls).toHaveLength(3);
  cache.clear();
});

test("refreshing asks again for shown identities without dropping them first", async () => {
  let roleName: string | null = "TA";
  const calls: string[][] = [];
  const cache = createProfileCache(
    async (users) => {
      calls.push(users);
      return users.map((user) => ({
        user,
        displayName: user,
        avatar: "",
        role: { name: roleName },
      }));
    },
    () => {},
  );
  cache.ensure("carmel");
  cache.ensure("eagon");
  await nextTurn();
  expect(cache.get("carmel")?.role.name).toBe("TA");

  roleName = null;
  cache.refresh({ users: ["carmel", "unknown-to-page"] });
  expect(cache.get("carmel")?.role.name).toBe("TA");
  await nextTurn();
  expect(calls[1]).toEqual(["carmel", "unknown-to-page"]);
  expect(cache.get("carmel")?.role.name).toBeNull();
  expect(cache.get("eagon")?.role.name).toBe("TA");

  cache.refresh({ olderThan: 60_000 });
  await nextTurn();
  expect(calls).toHaveLength(2);
  cache.refresh({ olderThan: 0 });
  await nextTurn();
  expect(calls[2]?.sort()).toEqual(["carmel", "eagon", "unknown-to-page"]);
  cache.clear();
});

test("clearing an account scope discards pending and late identity responses", async () => {
  let finish!: (
    rows: {
      user: string;
      displayName: string;
      avatar: string;
      role: { name: string | null };
    }[],
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
    {
      user: "former-account",
      displayName: "Private identity",
      avatar: "",
      role: { name: null },
    },
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
      return users.map((user) => ({
        user,
        displayName: user,
        avatar: "",
        role: { name: null },
      }));
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
