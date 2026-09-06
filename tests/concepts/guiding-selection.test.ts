import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { MongoGuidingConcept } from "../../src/concepts/guiding/guiding.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { referenceSelections } from "../../src/migrations/20260906T000100-reference-selections.ts";

describe("document library selections", () => {
  let guiding: MongoGuidingConcept;
  beforeAll(async () => {
    guiding = new MongoGuidingConcept(await testDb());
  });
  afterAll(stopTestDb);

  test("references are explicit, shared, and detachable without changing the source", async () => {
    const { guidance } = await guiding.give({
      subject: "commons",
      use: "drafting",
      title: "Reading",
      body: "Original",
    });
    expect(await guiding._selectedDocuments({ subject: "new", use: "drafting" })).toEqual({
      documents: [],
    });
    for (const subject of ["relay", "quiz"])
      await guiding.select({ subject, use: "drafting", guidances: [guidance] });
    await guiding.revise({ guidance, title: "Reading", body: "Revised" });
    expect(
      (await guiding._selectedDocuments({ subject: "quiz", use: "drafting" })).documents[0]?.body,
    ).toBe("Revised");
    await guiding.select({ subject: "relay", use: "drafting", guidances: [] });
    expect(
      (await guiding._selectedDocuments({ subject: "relay", use: "drafting" })).documents,
    ).toEqual([]);
    expect(
      (await guiding._selectedDocuments({ subject: "quiz", use: "drafting" })).documents,
    ).toHaveLength(1);
    expect(await guiding._guidance({ guidance })).toHaveLength(1);
    await guiding.remove({ guidance });
    expect(await guiding._selection({ subject: "quiz", use: "drafting" })).toEqual({
      guidances: [],
    });
  });

  test("selecting a missing document or a sorter note is refused without replacing existing references", async () => {
    const { guidance } = await guiding.give({
      subject: "commons",
      use: "drafting",
      title: "Keep",
      body: "Text",
    });
    const note = await guiding.give({
      subject: "round",
      use: "sorting",
      title: "",
      body: "Group by topic",
    });
    await guiding.select({ subject: "activity", use: "drafting", guidances: [guidance] });
    for (const missing of ["missing", note.guidance])
      await expect(
        guiding.select({ subject: "activity", use: "drafting", guidances: [missing] }),
      ).rejects.toThrow();
    expect(await guiding._selection({ subject: "activity", use: "drafting" })).toEqual({
      guidances: [guidance],
    });
  });

  test("migration preserves legacy global and relay references and can safely run twice", async () => {
    const database = await testDb();
    const legacy = new MongoGuidingConcept(database);
    const shared = await legacy.give({
      subject: "commons",
      use: "drafting",
      title: "Shared",
      body: "Shared text",
    });
    const own = await legacy.give({
      subject: "relay",
      use: "drafting",
      title: "Own",
      body: "Own text",
    });
    await database.collection<{ _id: string }>("relaying.relays").insertOne({ _id: "relay" });
    await database
      .collection<{ _id: string }>("questioning.questionnaires")
      .insertOne({ _id: "quiz" });
    await referenceSelections.up(database);
    expect((await legacy._selection({ subject: "relay", use: "drafting" })).guidances).toEqual([
      shared.guidance,
      own.guidance,
    ]);
    expect((await legacy._selection({ subject: "quiz", use: "drafting" })).guidances).toEqual([
      shared.guidance,
    ]);
    await legacy.select({ subject: "relay", use: "drafting", guidances: [] });
    await referenceSelections.up(database);
    expect((await legacy._selection({ subject: "relay", use: "drafting" })).guidances).toEqual([]);
    expect(
      (await legacy._documents({ subject: "commons", use: "drafting" })).documents,
    ).toHaveLength(2);
    await database.dropDatabase();
  });
});
