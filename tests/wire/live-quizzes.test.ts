import { expect, test } from "vite-plus/test";
import { wireNormalizer, wireScenario } from "../support/wire.ts";

test("live location normalization is opt-in and uses the unambiguous alphabet", () => {
  expect(wireNormalizer()("ABC234")).toBe("ABC234");

  const normalizeLive = wireNormalizer({ liveLocationCodes: true });
  expect(normalizeLive("AHJNP2")).toBe("location#1");
  expect(normalizeLive("AHJNP2")).toBe("location#1");
  expect(normalizeLive("AHINP2")).toBe("AHINP2");
});

wireScenario("live quiz loop", new URL("./fixtures/live-quizzes.json", import.meta.url), {
  liveLocationCodes: true,
});
