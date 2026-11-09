import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/overriding/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoOverridingConcept } from "../../src/concepts/overriding/overriding.mongo.ts";

afterAll(stopTestDb);

const at = new Date("2026-12-14T15:00:00Z");
const later = new Date("2026-12-14T16:00:00Z");

describe("Overriding", () => {
  test("an override keeps what it replaced, a second replaces the first, and clearing is idempotent", async () => {
    const c = new MongoOverridingConcept(await testDb());
    expect(
      await caughtError(() =>
        c.set({ subject: "leo", value: "B", reason: " ", replaced: "C", author: "ana", at }),
      ),
    ).toBeInstanceOf(refusalErrors.OverrideReasonRequired);
    expect(
      await caughtError(() =>
        c.set({ subject: "leo", value: "", reason: "why", replaced: "C", author: "ana", at }),
      ),
    ).toBeInstanceOf(refusalErrors.OverrideValueRequired);
    const first = await c.set({
      subject: "leo",
      value: "B",
      reason: "strong design work late in the term",
      replaced: "C",
      author: "ana",
      at,
    });
    const second = await c.set({
      subject: "leo",
      value: "B+",
      reason: "the meeting agreed",
      replaced: "C+",
      author: "ravi",
      at: later,
    });
    expect(second.override).toBe(first.override);
    expect(await c._override({ subject: "leo" })).toEqual([
      {
        override: first.override,
        value: "B+",
        reason: "the meeting agreed",
        replaced: "C+",
        author: "ravi",
        setAt: later,
      },
    ]);
    await c.set({
      subject: "mia",
      value: "A",
      reason: "r",
      replaced: "A−",
      author: "ana",
      at: new Date("2026-12-14T17:00:00Z"),
    });
    expect((await c._overrides()).overrides.map((row) => row.subject)).toEqual(["leo", "mia"]);
    expect(await c.clear({ subject: "leo" })).toEqual({ subject: "leo" });
    expect(await c.clear({ subject: "leo" })).toEqual({ subject: "leo" });
    expect(await c._override({ subject: "leo" })).toEqual([]);
    expect((await c._overrides()).overrides.map((row) => row.subject)).toEqual(["mia"]);
  });
});
