import { describe, expect, test } from "vite-plus/test";
import { reasonerConfigurationFromEnv } from "../../src/reasoning/configuration.ts";

describe("reasoner environment configuration", () => {
  test("keeps reasoning disabled when no Gemini key is configured", () => {
    expect(reasonerConfigurationFromEnv({})).toBeUndefined();
    expect(reasonerConfigurationFromEnv({ REASONER: "gemini" })).toBeUndefined();
    expect(reasonerConfigurationFromEnv({ REASONER: "   " })).toBeUndefined();
  });

  test("a Gemini key enables the default or configured model", () => {
    expect(reasonerConfigurationFromEnv({ GEMINI_API_KEY: "secret" })).toEqual({
      mode: "gemini",
      apiKey: "secret",
      model: "gemini-3.7-flash",
    });
    expect(
      reasonerConfigurationFromEnv({
        REASONER: "gemini",
        GEMINI_API_KEY: "secret",
        GEMINI_MODEL: "gemini-classroom",
      }),
    ).toEqual({ mode: "gemini", apiKey: "secret", model: "gemini-classroom" });
  });

  test("scripted mode remains available for development and tests", () => {
    expect(reasonerConfigurationFromEnv({ REASONER: " scripted ", NODE_ENV: "test" })).toEqual({
      mode: "scripted",
      apiKey: "",
      model: "scripted",
    });
  });

  test("production rejects the scripted reasoner", () => {
    expect(() =>
      reasonerConfigurationFromEnv({ REASONER: "scripted", NODE_ENV: "production" }),
    ).toThrow("reasoner: REASONER=scripted is not allowed in production.");
  });

  test("unknown nonempty reasoner modes are rejected", () => {
    for (const mode of ["fake", "Gemini", "disabled"]) {
      expect(() =>
        reasonerConfigurationFromEnv({ REASONER: mode, GEMINI_API_KEY: "secret" }),
      ).toThrow('reasoner: REASONER must be "gemini" or "scripted".');
    }
  });
});
