import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { MongoPostingConcept } from "./posting.mongo.ts";
import { PostingConcept } from "./posting.ts";

const floors: [string, () => Promise<PostingConcept | MongoPostingConcept>][] = [
  ["in memory", async () => new PostingConcept()],
  ["on MongoDB", async () => new MongoPostingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Posting ${floor}`, () => {
    test("create records the author, content, creation time, and no edit time", async () => {
      const posting = await make();
      const at = new Date("2026-01-05T09:00:00Z");
      const { post } = await posting.create({ author: "amara", content: "Hello all", at });
      expect(await posting._getPost({ post })).toEqual([
        { author: "amara", content: "Hello all", createdAt: at, editedAt: null },
      ]);
    });

    test("delete removes the post", async () => {
      const posting = await make();
      const { post } = await posting.create({
        author: "amara",
        content: "Hello all",
        at: new Date("2026-01-05T09:00:00Z"),
      });
      expect(await posting.delete({ post })).toEqual({ post });
      expect(await posting._getPost({ post })).toEqual([]);
    });

    test("deleting an unknown post refuses with POST_NOT_FOUND", async () => {
      const posting = await make();
      const err = await refusal(() => posting.delete({ post: "no-such-post" }));
      expect(err).toBeInstanceOf(refusalErrors.PostNotFound);
    });

    test("edit replaces content and stamps editedAt", async () => {
      const posting = await make();
      const { post } = await posting.create({
        author: "amara",
        content: "first",
        at: new Date("2026-01-05T09:00:00Z"),
      });
      const editedAt = new Date("2026-01-07T12:00:00Z");
      expect(await posting.edit({ post, content: "second", at: editedAt })).toEqual({ post });
      expect(await posting._getPost({ post })).toEqual([
        {
          author: "amara",
          content: "second",
          createdAt: new Date("2026-01-05T09:00:00Z"),
          editedAt,
        },
      ]);
    });

    test("editing an unknown post refuses with POST_NOT_FOUND", async () => {
      const posting = await make();
      const err = await refusal(() =>
        posting.edit({ post: "no-such-post", content: "x", at: new Date() }),
      );
      expect(err).toBeInstanceOf(refusalErrors.PostNotFound);
    });

    test("_getByAuthor returns an author's posts newest first", async () => {
      const posting = await make();
      const { post: p1 } = await posting.create({
        author: "amara",
        content: "one",
        at: new Date("2026-01-01T00:00:00Z"),
      });
      const { post: p2 } = await posting.create({
        author: "noah",
        content: "other",
        at: new Date("2026-01-02T00:00:00Z"),
      });
      const { post: p3 } = await posting.create({
        author: "amara",
        content: "three",
        at: new Date("2026-01-03T00:00:00Z"),
      });
      expect(await posting._getByAuthor({ author: "amara" })).toEqual([{ post: p3 }, { post: p1 }]);
      expect(await posting._getByAuthor({ author: "noah" })).toEqual([{ post: p2 }]);
    });

    test("_getByAuthor breaks same-moment ties by the later record", async () => {
      const posting = await make();
      const at = new Date("2026-01-04T00:00:00Z");
      const { post: first } = await posting.create({ author: "amara", content: "a", at });
      const { post: second } = await posting.create({ author: "amara", content: "b", at });
      expect(await posting._getByAuthor({ author: "amara" })).toEqual([
        { post: second },
        { post: first },
      ]);
    });
  });
}
