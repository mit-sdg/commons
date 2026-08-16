import { describe, expect, test } from "vite-plus/test";
import { configuredMongodbUrl, validateDeploymentConfiguration } from "../../src/deployment.ts";

const productionEnvironment = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  PUBLIC_ORIGIN: "https://class.mit-sdg.dev",
  INVITATION_SECRET: "test-invitation-secret",
  ...overrides,
});

describe("deployment MongoDB configuration", () => {
  test("accepts the platform MONGODB_URI name and the legacy MONGODB_URL name", () => {
    expect(configuredMongodbUrl({ MONGODB_URI: "mongodb://platform/class" })).toBe(
      "mongodb://platform/class",
    );
    expect(configuredMongodbUrl({ MONGODB_URL: "mongodb://legacy/commons" })).toBe(
      "mongodb://legacy/commons",
    );
  });

  test("accepts matching aliases and treats empty aliases as absent", () => {
    const connection = "mongodb://platform/class";
    expect(configuredMongodbUrl({ MONGODB_URI: connection, MONGODB_URL: connection })).toBe(
      connection,
    );
    expect(configuredMongodbUrl({ MONGODB_URI: "", MONGODB_URL: connection })).toBe(connection);
    expect(configuredMongodbUrl({ MONGODB_URI: "", MONGODB_URL: "" })).toBeUndefined();
  });

  test("rejects conflicting aliases without exposing either connection", () => {
    const platform = "mongodb://platform-user:platform-secret@mongo/class";
    const legacy = "mongodb://legacy-user:legacy-secret@mongo/commons";
    let message = "";
    try {
      configuredMongodbUrl({ MONGODB_URI: platform, MONGODB_URL: legacy });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("commons: MONGODB_URI and MONGODB_URL must not conflict.");
    expect(message).not.toContain(platform);
    expect(message).not.toContain(legacy);
    expect(message).not.toContain("secret");
  });

  test("requires one MongoDB setting in production", () => {
    expect(() => validateDeploymentConfiguration(productionEnvironment())).toThrow(
      "commons: MONGODB_URI or MONGODB_URL is required in production.",
    );
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({ MONGODB_URI: "mongodb://platform/class" }),
      ),
    ).not.toThrow();
  });
});
