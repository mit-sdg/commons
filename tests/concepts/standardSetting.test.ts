import { afterAll, expect, test } from "vite-plus/test";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { MongoStandardSettingConcept } from "../../src/concepts/standardSetting/standardSetting.mongo.ts";
import { InvalidStandard, StandardConflict } from "../../src/concepts/standardSetting/errors.ts";
afterAll(stopTestDb);
const content = {
  name: "Argumentation",
  description: "Connect claims to evidence.",
  deficient: "No identifiable claim.",
  emergent: "Claim with incomplete support.",
  competent: "Explicit reasoning connects evidence to claim.",
  expert: "Evaluates competing explanations.",
  referenceUrl: "https://example.org/rubric",
};
test("clarification appends an edition while previous meaning stays accessible", async () => {
  const c = new MongoStandardSettingConcept(await testDb());
  const first = await c.define(content);
  const next = await c.revise({
    ...content,
    ...first,
    expectedEdition: first.edition,
    expert: "Addresses counterarguments explicitly.",
  });
  expect((await c._getEdition({ edition: first.edition }))[0]?.expert).toBe(content.expert);
  expect((await c._getStandards())[0]?.edition).toBe(next.edition);
  await expect(
    c.revise({ ...content, ...first, expectedEdition: first.edition }),
  ).rejects.toBeInstanceOf(StandardConflict);
});
test("two editors cannot both issue from the same edition", async () => {
  const c = new MongoStandardSettingConcept(await testDb());
  const first = await c.define(content);
  const results = await Promise.allSettled([
    c.revise({ ...content, ...first, expectedEdition: first.edition }),
    c.revise({ ...content, ...first, expectedEdition: first.edition }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await c._getStandards())[0]?.number).toBe(2);
});
test("incomplete descriptions and executable or credentialed links are refused", async () => {
  const c = new MongoStandardSettingConcept(await testDb());
  for (const change of [
    { competent: " " },
    { referenceUrl: "javascript:alert(1)" },
    { referenceUrl: "https://user:pass@example.org" },
    { referenceUrl: "/relative" },
  ])
    await expect(c.define({ ...content, ...change })).rejects.toBeInstanceOf(InvalidStandard);
  expect(await c._getStandards()).toEqual([]);
});
