import { cardId } from "../../src/computations/live-rounds.ts";
import { afterAll, expect, test } from "vite-plus/test";
import { MongoTrashingConcept } from "../../src/concepts/trashing/trashing.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { placingPassage, wallCardIds } from "../../src/computations/live-walls.ts";

afterAll(stopTestDb);

test("the round's trashed subset writes the same brief as the whole trash", async () => {
  const trash = new MongoTrashingConcept(await testDb());
  const at = new Date();
  const removedCard = cardId({ response: "removed", item: "question" });
  for (const item of [removedCard, "other-round", "foreign"]) {
    await trash.trash({ item, by: "host", at });
  }
  const values = [
    { response: "retained", participant: "phone-1", item: "question", value: "keep" },
    { response: "removed", participant: "phone-2", item: "question", value: "send" },
  ];
  const categories: Parameters<typeof placingPassage>[0]["categories"] = [];
  const { items: everything } = await trash._trashedItems({});
  const { trashed: subset } = await trash._trashedAmong({
    items: wallCardIds({ values, categories }),
  });
  const value = {
    title: "Subset",
    form: "survey",
    disclosure: "score",
    questions: [
      {
        item: "question",
        prompt: "One word",
        choices: [],
        expected: "",
        explanation: "",
        position: 1,
      },
    ],
  };
  const brief = (removed: string[]) =>
    placingPassage({ value, values, categories, removed, notes: "" });
  expect(subset).toEqual([removedCard]);
  expect(everything).toEqual(expect.arrayContaining([removedCard, "other-round", "foreign"]));
  expect(brief(subset)).toBe(brief(everything));
  expect(brief(subset)).toContain("keep");
  expect(brief(subset)).not.toContain("send");
});
