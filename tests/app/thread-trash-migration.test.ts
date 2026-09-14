import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { threadTrash } from "../../src/migrations/20260914T000100-thread-trash.ts";

afterAll(stopTestDb);
const at = new Date("2026-09-01T00:00:00Z");

async function fixture() {
  const database = await testDb();
  const floor = mongoImplementations(database);
  const { post } = await floor.Posting.create({ author: "author", content: "Opening", at });
  const { conversation, node } = await floor.Conversing.start({ item: post, at });
  const { post: reply } = await floor.Posting.create({ author: "reader", content: "Reply", at });
  await floor.Conversing.reply({ item: reply, parent: node, at });
  await floor.Trashing.trash({ item: post, by: "moderator", at });
  await floor.Trashing.trash({ item: reply, by: "other-moderator", at });
  return { database, floor, post, reply, conversation };
}

test("old opening markers become whole-thread markers, preserving attribution and separate reply trash", async () => {
  const f = await fixture();
  expect(await threadTrash.up(f.database)).not.toHaveProperty("blocked");
  expect(await f.floor.Trashing._getTrashed({})).toEqual([
    { item: f.reply, trashedBy: "other-moderator", trashedAt: at },
    { item: f.conversation, trashedBy: "moderator", trashedAt: at },
  ]);
  expect(await f.floor.Posting._getPost({ post: f.post })).toHaveLength(1);
  expect(await f.floor.Posting._getPost({ post: f.reply })).toHaveLength(1);
  expect(await threadTrash.up(f.database)).not.toHaveProperty("blocked");
  expect(await f.floor.Trashing._getTrashed({})).toHaveLength(2);
});

test("an interrupted migration preserves an already-established thread marker", async () => {
  const f = await fixture();
  const later = new Date("2026-09-02T00:00:00Z");
  await f.floor.Trashing.trash({ item: f.conversation, by: "thread-moderator", at: later });
  expect(await threadTrash.up(f.database)).not.toHaveProperty("blocked");
  expect(await f.floor.Trashing._getTrashed({})).toContainEqual({
    item: f.conversation,
    trashedBy: "thread-moderator",
    trashedAt: later,
  });
  expect(await f.floor.Trashing._isTrashed({ item: f.post })).toEqual({ trashed: false });
});

test("already-destroyed openings require explicit repair rather than destroying or exposing surviving replies", async () => {
  const f = await fixture();
  await f.floor.Posting.delete({ post: f.post });
  const before = await f.floor.Trashing._getTrashed({});
  const result = await threadTrash.up(f.database);
  expect(result.blocked).toContain(f.conversation);
  expect(await f.floor.Trashing._getTrashed({})).toEqual(before);
  expect(await f.floor.Posting._getPost({ post: f.reply })).toHaveLength(1);
  expect(await f.floor.Conversing._getThread({ conversation: f.conversation })).toHaveLength(2);
});
