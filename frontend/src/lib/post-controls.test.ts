import { expect, test } from "bun:test";
import { createPostControlsCache, type PostControls } from "./post-controls";

const row = (post: string, saved = false): PostControls => ({
  post,
  saved,
  pinned: false,
  reactions: [],
  backlinks: 0,
  forwardLinks: 0,
});
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

test("post controls batch distinct demands in bounded sequential reads", async () => {
  const requests: string[][] = [];
  let active = 0;
  let maxActive = 0;
  const cache = createPostControlsCache(
    async (posts) => {
      requests.push(posts);
      maxActive = Math.max(maxActive, ++active);
      await tick();
      active -= 1;
      return posts.map((post) => row(post));
    },
    () => {},
  );
  for (let n = 0; n < 70; n++) {
    cache.ensure(String(n));
    cache.ensure(String(n));
  }
  for (let n = 0; n < 20 && !cache.get("69"); n++) await tick();
  expect(requests.map((posts) => posts.length)).toEqual([32, 32, 6]);
  expect(maxActive).toBe(1);
  expect(cache.get("69")?.data).toEqual(row("69"));
  cache.ensure("0");
  await tick();
  expect(requests).toHaveLength(3);
  cache.refresh("0");
  expect(cache.get("0")).toBeUndefined();
  await tick();
  await tick();
  expect(requests.at(-1)).toEqual(["0"]);
  cache.clear();
});

test("missing and failed controls stay unavailable and retry explicitly", async () => {
  let attempts = 0;
  const cache = createPostControlsCache(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("database detail must stay private");
      return [];
    },
    () => {},
  );
  cache.ensure("post");
  await tick();
  expect(cache.get("post")).toEqual({
    data: null,
    error: "Post controls are unavailable.",
  });
  cache.ensure("post");
  await tick();
  expect(attempts).toBe(1);
  cache.refresh("post");
  await tick();
  expect(cache.get("post")).toEqual({
    data: null,
    error: "That item is not available.",
  });
  cache.clear();
});

test("an account or discussion reset discards delayed results and queued requests", async () => {
  let finish!: (rows: PostControls[]) => void;
  let changes = 0;
  const cache = createPostControlsCache(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    () => {
      changes += 1;
    },
  );
  for (let n = 0; n < 40; n++) cache.ensure(String(n));
  await tick();
  cache.clear();
  finish([row("0", true)]);
  await tick();
  expect(cache.get("0")).toBeUndefined();
  expect(changes).toBe(0);
});

test("a refresh during an in-flight read queues a fresh observation", async () => {
  const completions: ((rows: PostControls[]) => void)[] = [];
  const cache = createPostControlsCache(
    () =>
      new Promise((resolve) => {
        completions.push(resolve);
      }),
    () => {},
  );
  cache.ensure("post");
  await tick();
  cache.refresh("post");
  completions[0]([row("post", false)]);
  await tick();
  expect(cache.get("post")).toBeUndefined();
  expect(completions).toHaveLength(2);
  completions[1]([row("post", true)]);
  await tick();
  expect(cache.get("post")?.data?.saved).toBe(true);
  cache.clear();
});
