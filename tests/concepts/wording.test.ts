import { afterAll, describe, expect, test } from "vite-plus/test";
import { InvalidWording } from "../../src/concepts/wording/errors.ts";
import { MongoWordingConcept } from "../../src/concepts/wording/wording.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("Wording on MongoDB", () => {
  test("words a place, keeps it across instances, and withdraws it", async () => {
    const db = await testDb();
    const wording = new MongoWordingConcept(db);
    expect(await wording._wordingIn({ place: "overdue-notice" })).toEqual([]);
    expect(
      await wording.word({
        place: "overdue-notice",
        heading: " Welcome ",
        passage: " First\r\nSecond ",
      }),
    ).toEqual({ heading: "Welcome", passage: "First\nSecond" });

    const restarted = new MongoWordingConcept(db);
    expect(await restarted._wordingIn({ place: "overdue-notice" })).toEqual([
      { heading: "Welcome", passage: "First\nSecond" },
    ]);
    await restarted.word({ place: "overdue-notice", heading: "Updated", passage: "New copy" });
    await restarted.word({ place: "welcome", heading: "Other", passage: "Independent" });

    // Withdrawing an empty place succeeds, so the application's words are always reachable.
    await restarted.withdraw({ place: "overdue-notice" });
    await restarted.withdraw({ place: "overdue-notice" });
    expect(await wording._wordingIn({ place: "overdue-notice" })).toEqual([]);
    expect(await wording._wordingIn({ place: "welcome" })).toEqual([
      { heading: "Other", passage: "Independent" },
    ]);
  });

  test("refused wording leaves the wording already standing whole", async () => {
    const wording = new MongoWordingConcept(await testDb());
    const standing = { heading: "Welcome", passage: "Some text" };
    await wording.word({ place: "overdue-notice", ...standing });
    for (const invalid of [
      { heading: " ", passage: "Passage" },
      { heading: "Heading", passage: " \n " },
      { heading: "x".repeat(201), passage: "Passage" },
      { heading: "Heading", passage: "x".repeat(20_001) },
      { heading: "Heading\r\nBcc: outsider@example.edu", passage: "Passage" },
      { heading: "Heading\n", passage: "Passage" },
      { heading: "Heading\u2028line", passage: "Passage" },
      { heading: "Heading", passage: "Bad\0passage" },
    ]) {
      await expect(wording.word({ place: "overdue-notice", ...invalid })).rejects.toBeInstanceOf(
        InvalidWording,
      );
      expect(await wording._wordingIn({ place: "overdue-notice" })).toEqual([standing]);
    }
  });

  test("accepts wording exactly at the bounds", async () => {
    const wording = new MongoWordingConcept(await testDb());
    const heading = "h".repeat(200);
    const passage = "p".repeat(20_000);
    expect(await wording.word({ place: "overdue-notice", heading, passage })).toEqual({
      heading,
      passage,
    });
  });
});
