import { afterAll, describe, expect, test, vi } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/guiding/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoGuidingConcept } from "../../src/concepts/guiding/guiding.mongo.ts";

const floors: [string, () => Promise<MongoGuidingConcept>][] = [
  ["on MongoDB", async () => new MongoGuidingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

async function instrumentedGuiding() {
  const db = await testDb();
  const documents = db.collection("guiding.guidance");
  const selections = db.collection("guiding.selections");
  const collection = db.collection.bind(db);
  vi.spyOn(db, "collection").mockImplementation((name, options) => {
    if (name === "guiding.guidance") return documents;
    if (name === "guiding.selections") return selections;
    return collection(name, options);
  });
  return { guiding: new MongoGuidingConcept(db), documents, selections };
}

test("a delayed first note cannot compete with a second save's choice of record", async () => {
  const { guiding, documents } = await instrumentedGuiding();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const insert = documents.insertOne.bind(documents);
  vi.spyOn(documents, "insertOne").mockImplementationOnce(async (...args) => {
    entered.resolve();
    await release.promise;
    return insert(...args);
  });
  const reads = vi.spyOn(documents, "find");
  const first = guiding.set({ subject: "round", use: "sorting", title: "", body: "First" });
  await entered.promise;
  const second = guiding.set({ subject: "round", use: "sorting", title: "", body: "Second" });
  try {
    // The second action must not choose a record while the first still owns
    // an uninserted record. This is the start of the lost-note interleaving.
    await Promise.resolve();
    expect(reads).toHaveBeenCalledTimes(1);
  } finally {
    release.resolve();
    await Promise.all([first, second]);
  }
  expect(await first).toEqual(await second);
  expect(await guiding._guidanceFor({ subject: "round", use: "sorting" })).toEqual([
    { guidance: (await second).guidance, title: "", body: "Second" },
  ]);
});

test("removing a document during a delayed selection cannot leave a dangling selection", async () => {
  const { guiding, documents, selections } = await instrumentedGuiding();
  const { guidance } = await guiding.give({
    subject: "library",
    use: "drafting",
    title: "Reading",
    body: "Read this.",
  });
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const update = selections.updateOne.bind(selections);
  vi.spyOn(selections, "updateOne").mockImplementationOnce(async (...args) => {
    entered.resolve();
    await release.promise;
    return update(...args);
  });
  const selected = guiding.select({ subject: "relay", use: "drafting", guidances: [guidance] });
  await entered.promise;
  const deletes = vi.spyOn(documents, "deleteOne");
  const removed = guiding.remove({ guidance });
  try {
    await Promise.resolve();
    expect(deletes).not.toHaveBeenCalled();
  } finally {
    release.resolve();
    await Promise.all([selected, removed]);
  }
  expect(await guiding._selection({ subject: "relay", use: "drafting" })).toEqual({
    guidances: [],
  });
  await expect(
    guiding.select({ subject: "relay", use: "drafting", guidances: [guidance] }),
  ).rejects.toBeInstanceOf(refusalErrors.GuidanceNotFound);
  // A failed mutation must not poison later saves.
  await guiding.select({ subject: "relay", use: "drafting", guidances: [] });
});

test("replacing several documents removes discarded identities from selections", async () => {
  const guiding = new MongoGuidingConcept(await testDb());
  const first = await guiding.give({ subject: "s", use: "drafting", title: "First", body: "A" });
  const second = await guiding.give({ subject: "s", use: "drafting", title: "Second", body: "B" });
  await guiding.select({
    subject: "relay",
    use: "drafting",
    guidances: [first.guidance, second.guidance],
  });
  await guiding.set({ subject: "s", use: "drafting", title: "Kept", body: "C" });
  expect(await guiding._selection({ subject: "relay", use: "drafting" })).toEqual({
    guidances: [first.guidance],
  });
});

test("concurrent clears succeed once and a later save remains", async () => {
  const guiding = new MongoGuidingConcept(await testDb());
  const { guidance } = await guiding.set({
    subject: "round",
    use: "sorting",
    title: "",
    body: "Old",
  });
  await guiding.select({ subject: "relay", use: "sorting", guidances: [guidance] });
  const [first, second] = await Promise.all([
    guiding.clear({ subject: "round", use: "sorting" }),
    guiding.clear({ subject: "round", use: "sorting" }),
    guiding.set({ subject: "round", use: "sorting", title: "", body: "New" }),
  ]);
  expect([first, second]).toEqual([{ cleared: true }, { cleared: false }]);
  expect(await guiding._guidanceText({ subject: "round", use: "sorting" })).toEqual({
    text: "New",
  });
  expect(await guiding._selection({ subject: "relay", use: "sorting" })).toEqual({ guidances: [] });
});

for (const [floor, make] of floors) {
  describe(`Guiding ${floor}`, () => {
    test("give stands guidance beside a subject under a use, trimmed and in order", async () => {
      const guiding = await make();
      const first = await guiding.give({
        subject: "round-1",
        use: "sorting",
        title: "  ",
        body: "  Group by what went wrong.  ",
      });
      const second = await guiding.give({
        subject: "round-1",
        use: "sorting",
        title: " Pace ",
        body: "Keep pace apart from content.",
      });
      expect(await guiding._guidanceFor({ subject: "round-1", use: "sorting" })).toEqual([
        { guidance: first.guidance, title: "", body: "Group by what went wrong." },
        { guidance: second.guidance, title: "Pace", body: "Keep pace apart from content." },
      ]);
      expect(await guiding._guidance({ guidance: second.guidance })).toEqual([
        {
          subject: "round-1",
          use: "sorting",
          title: "Pace",
          body: "Keep pace apart from content.",
        },
      ]);
    });

    test("guidance under another use, or beside another subject, is not read", async () => {
      const guiding = await make();
      await guiding.give({ subject: "round-1", use: "sorting", title: "", body: "Sort." });
      await guiding.give({ subject: "round-1", use: "answering", title: "", body: "Answer." });
      await guiding.give({ subject: "round-2", use: "sorting", title: "", body: "Other." });
      expect(await guiding._guidanceText({ subject: "round-1", use: "sorting" })).toEqual({
        text: "Sort.",
      });
      expect(await guiding._guidanceText({ subject: "round-1", use: "drafting" })).toEqual({
        text: "",
      });
      expect(
        await guiding._guidanceTexts({
          subjects: ["round-2", "round-1", "round-9"],
          use: "sorting",
        }),
      ).toEqual({
        texts: [
          { subject: "round-2", text: "Other." },
          { subject: "round-1", text: "Sort." },
          { subject: "round-9", text: "" },
        ],
      });
      expect(await guiding._guidanceTexts({ subjects: [], use: "sorting" })).toEqual({ texts: [] });
    });

    test("the text of several entries is read whole, a blank line between", async () => {
      const guiding = await make();
      await guiding.give({ subject: "relay", use: "drafting", title: "Syllabus", body: "One." });
      await guiding.give({ subject: "relay", use: "drafting", title: "Notes", body: "Two." });
      expect(await guiding._guidanceText({ subject: "relay", use: "drafting" })).toEqual({
        text: "One.\n\nTwo.",
      });
    });

    test("giving with a blank use, a long title, or nothing to say is refused", async () => {
      const guiding = await make();
      expect(
        await refusal(() => guiding.give({ subject: "s", use: " ", title: "", body: "Say." })),
      ).toBeInstanceOf(refusalErrors.InvalidUse);
      expect(
        await refusal(() =>
          guiding.give({ subject: "s", use: "sorting", title: "t".repeat(201), body: "Say." }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidTitle);
      expect(
        await refusal(() => guiding.give({ subject: "s", use: "sorting", title: "", body: "  " })),
      ).toBeInstanceOf(refusalErrors.InvalidGuidance);
      expect(
        await refusal(() =>
          guiding.give({ subject: "s", use: "sorting", title: "", body: "b".repeat(40_001) }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidGuidance);
      expect(await guiding._guidanceFor({ subject: "s", use: "sorting" })).toEqual([]);
    });

    test("set leaves one entry under a use, whichever hands wrote and in whatever order", async () => {
      const guiding = await make();
      const first = await guiding.set({ subject: "s", use: "sorting", title: "", body: " One. " });
      expect(await guiding._guidanceFor({ subject: "s", use: "sorting" })).toEqual([
        { guidance: first.guidance, title: "", body: "One." },
      ]);
      expect(await guiding.set({ subject: "s", use: "sorting", title: "", body: "Two." })).toEqual(
        first,
      );
      expect(await guiding._guidanceText({ subject: "s", use: "sorting" })).toEqual({
        text: "Two.",
      });
      // Two given already, as two hands racing give would leave: set keeps the earliest.
      const other = await guiding.give({ subject: "t", use: "sorting", title: "", body: "A." });
      await guiding.give({ subject: "t", use: "sorting", title: "", body: "B." });
      expect(await guiding.set({ subject: "t", use: "sorting", title: "", body: "C." })).toEqual(
        other,
      );
      expect(await guiding._guidanceFor({ subject: "t", use: "sorting" })).toEqual([
        { guidance: other.guidance, title: "", body: "C." },
      ]);
      // Two sets at once converge on one entry.
      const raced = await Promise.all([
        guiding.set({ subject: "u", use: "sorting", title: "", body: "Left." }),
        guiding.set({ subject: "u", use: "sorting", title: "", body: "Right." }),
      ]);
      const stands = await guiding._guidanceFor({ subject: "u", use: "sorting" });
      expect(stands).toHaveLength(1);
      expect(["Left.", "Right."]).toContain(stands[0]?.body);
      expect(raced.map((one) => one.guidance)).toContain(stands[0]?.guidance);
      // Another use beside the same subject is untouched.
      await guiding.give({ subject: "s", use: "drafting", title: "Doc", body: "Kept." });
      await guiding.set({ subject: "s", use: "sorting", title: "", body: "Three." });
      expect(await guiding._guidanceFor({ subject: "s", use: "drafting" })).toHaveLength(1);
      expect(
        await refusal(() => guiding.set({ subject: "s", use: "sorting", title: "", body: "" })),
      ).toBeInstanceOf(refusalErrors.InvalidGuidance);
    });

    test("revise rewrites the words and keeps the place; remove takes it away", async () => {
      const guiding = await make();
      const first = await guiding.give({ subject: "s", use: "sorting", title: "", body: "One." });
      const second = await guiding.give({ subject: "s", use: "sorting", title: "", body: "Two." });
      expect(
        await guiding.revise({ guidance: first.guidance, title: " First ", body: " Changed. " }),
      ).toEqual({ guidance: first.guidance });
      expect(await guiding._guidanceFor({ subject: "s", use: "sorting" })).toEqual([
        { guidance: first.guidance, title: "First", body: "Changed." },
        { guidance: second.guidance, title: "", body: "Two." },
      ]);
      expect(
        await refusal(() => guiding.revise({ guidance: first.guidance, title: "", body: "" })),
      ).toBeInstanceOf(refusalErrors.InvalidGuidance);
      expect(await guiding.remove({ guidance: first.guidance })).toEqual({
        guidance: first.guidance,
      });
      expect(await guiding._guidance({ guidance: first.guidance })).toEqual([]);
      expect(
        await refusal(() => guiding.revise({ guidance: first.guidance, title: "", body: "Back." })),
      ).toBeInstanceOf(refusalErrors.GuidanceNotFound);
      expect(await refusal(() => guiding.remove({ guidance: first.guidance }))).toBeInstanceOf(
        refusalErrors.GuidanceNotFound,
      );
    });
  });
}
