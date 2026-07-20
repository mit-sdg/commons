import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "./errors.ts";
import { caughtError, stopTestDb, testDb } from "../testing.ts";
import { ConversingConcept } from "./conversing.ts";
import { MongoConversingConcept } from "./conversing.mongo.ts";

const floors: [string, () => Promise<ConversingConcept | MongoConversingConcept>][] = [
  ["in memory", async () => new ConversingConcept()],
  ["on MongoDB", async () => new MongoConversingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Conversing ${floor}`, () => {
    test("start places the item as the root of a fresh conversation", async () => {
      const conversing = await make();
      const { conversation, node } = await conversing.start({
        item: "question",
        at: new Date("2026-02-01T10:00:00Z"),
      });
      expect(await conversing._getThread({ conversation })).toEqual([
        { node, item: "question", parent: null, depth: 0 },
      ]);
      expect(await conversing._getConversation({ node })).toEqual([{ conversation }]);
      expect(await conversing._getNodeByItem({ item: "question" })).toEqual([{ node }]);
      expect(await conversing._parentOf({ node })).toEqual([]);
    });

    test("reply hangs the item one level beneath its parent", async () => {
      const conversing = await make();
      const { conversation, node: root } = await conversing.start({
        item: "question",
        at: new Date("2026-02-01T10:00:00Z"),
      });
      const { node: answer } = await conversing.reply({
        item: "answer",
        parent: root,
        at: new Date("2026-02-01T11:00:00Z"),
      });
      const { node: followUp } = await conversing.reply({
        item: "follow-up",
        parent: answer,
        at: new Date("2026-02-01T12:00:00Z"),
      });
      expect(await conversing._getThread({ conversation })).toEqual([
        { node: root, item: "question", parent: null, depth: 0 },
        { node: answer, item: "answer", parent: root, depth: 1 },
        { node: followUp, item: "follow-up", parent: answer, depth: 2 },
      ]);
      expect(await conversing._parentOf({ node: answer })).toEqual([{ parent: root }]);
      expect(await conversing._hasChildren({ node: answer })).toEqual({ present: true });
      expect(await conversing._hasChildren({ node: followUp })).toEqual({ present: false });
    });

    test("an item already placed cannot start or be replied with again", async () => {
      const conversing = await make();
      const { node: root } = await conversing.start({
        item: "question",
        at: new Date("2026-02-01T10:00:00Z"),
      });
      expect(
        await refusal(() =>
          conversing.start({ item: "question", at: new Date("2026-02-01T11:00:00Z") }),
        ),
      ).toBeInstanceOf(refusalErrors.ItemAlreadyInConversation);
      expect(
        await refusal(() =>
          conversing.reply({
            item: "question",
            parent: root,
            at: new Date("2026-02-01T11:00:00Z"),
          }),
        ),
      ).toBeInstanceOf(refusalErrors.ItemAlreadyInConversation);
    });

    test("replying to an unknown node refuses with PARENT_NODE_NOT_FOUND", async () => {
      const conversing = await make();
      const err = await refusal(() =>
        conversing.reply({
          item: "answer",
          parent: "no-such-node",
          at: new Date("2026-02-01T11:00:00Z"),
        }),
      );
      expect(err).toBeInstanceOf(refusalErrors.ParentNodeNotFound);
    });

    test("a node with replies beneath it cannot be removed", async () => {
      const conversing = await make();
      const { node: root } = await conversing.start({
        item: "question",
        at: new Date("2026-02-01T10:00:00Z"),
      });
      await conversing.reply({
        item: "answer",
        parent: root,
        at: new Date("2026-02-01T11:00:00Z"),
      });
      expect(await refusal(() => conversing.remove({ node: root }))).toBeInstanceOf(
        refusalErrors.NodeHasChildren,
      );
    });

    test("removing an unknown node refuses with NODE_NOT_FOUND", async () => {
      const conversing = await make();
      expect(await refusal(() => conversing.remove({ node: "no-such-node" }))).toBeInstanceOf(
        refusalErrors.NodeNotFound,
      );
    });

    test("removing leaves up to the last node deletes the conversation itself", async () => {
      const conversing = await make();
      const { conversation, node: root } = await conversing.start({
        item: "question",
        at: new Date("2026-02-01T10:00:00Z"),
      });
      const { node: answer } = await conversing.reply({
        item: "answer",
        parent: root,
        at: new Date("2026-02-01T11:00:00Z"),
      });
      await conversing.remove({ node: answer });
      expect(await conversing._getThread({ conversation })).toHaveLength(1);
      expect(await conversing._getConversations({})).toHaveLength(1);
      await conversing.remove({ node: root });
      expect(await conversing._getThread({ conversation })).toEqual([]);
      expect(await conversing._getConversations({})).toEqual([]);
    });

    test("conversations list newest-created first and most-recently-active first", async () => {
      const conversing = await make();
      const first = await conversing.start({ item: "first", at: new Date("2026-02-01T10:00:00Z") });
      const second = await conversing.start({
        item: "second",
        at: new Date("2026-02-02T10:00:00Z"),
      });
      await conversing.reply({
        item: "late-reply",
        parent: first.node,
        at: new Date("2026-02-03T10:00:00Z"),
      });

      const byCreation = await conversing._getConversations({});
      expect(byCreation.map((row) => row.conversation)).toEqual([
        second.conversation,
        first.conversation,
      ]);
      expect(byCreation.map((row) => row.item)).toEqual(["second", "first"]);

      const byActivity = await conversing._getConversationsByLastActivity({});
      expect(byActivity.map((row) => row.conversation)).toEqual([
        first.conversation,
        second.conversation,
      ]);
      expect(byActivity[0]?.lastActivityAt).toEqual(new Date("2026-02-03T10:00:00Z"));
    });
  });
}
