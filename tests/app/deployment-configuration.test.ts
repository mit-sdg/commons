import { MongoClient } from "mongodb";
import { constructConceptFloor } from "../../src/assembly/concept-floor.ts";
import { describe, expect, test } from "vite-plus/test";
import {
  configuredConnectAppDomain,
  configuredMongodbUrl,
  validateDeploymentConfiguration,
} from "../../src/deployment.ts";

const productionEnvironment = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  PUBLIC_ORIGIN: "https://class.mit-sdg.dev",
  INVITATION_SECRET: "test-invitation-secret-0123456789abcdef",
  VOUCHER_SECRET: "test-voucher-secret-0123456789abcdef",
  ...overrides,
});

describe("the domain whose apps may sign people in with Commons", () => {
  test("is optional, and normalized to a lowercase hostname", () => {
    expect(configuredConnectAppDomain({})).toBeUndefined();
    expect(configuredConnectAppDomain({ CONNECT_APP_DOMAIN: "" })).toBeUndefined();
    expect(configuredConnectAppDomain({ CONNECT_APP_DOMAIN: "  " })).toBeUndefined();
    expect(configuredConnectAppDomain({ CONNECT_APP_DOMAIN: "  MIT-SDG.dev  " })).toBe(
      "mit-sdg.dev",
    );
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({
          CONNECT_APP_DOMAIN: "mit-sdg.dev",
          MONGODB_URI: "mongodb://platform/class",
        }),
      ),
    ).not.toThrow();
  });

  test("stops startup when it is not a bare hostname", () => {
    for (const domain of [
      "*.mit-sdg.dev",
      ".mit-sdg.dev",
      "https://mit-sdg.dev",
      "mit-sdg.dev:443",
      "mit-sdg.dev/",
      "mit-sdg.dev?query",
      "mit-sdg.dev#fragment",
      "user@mit-sdg.dev",
      "mit-sdg.dev,example.edu",
      "mit..sdg.dev",
      "-mit-sdg.dev",
      "mit-sdg-.dev",
      "mit-sdg.dev.",
      `${"x".repeat(64)}.dev`,
    ]) {
      expect(() => validateDeploymentConfiguration({ CONNECT_APP_DOMAIN: domain }), domain).toThrow(
        "CONNECT_APP_DOMAIN must be a hostname",
      );
    }
  });
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

  test("requires the voucher secret in production", () => {
    const environment = productionEnvironment({ MONGODB_URI: "mongodb://platform/class" });
    delete environment.VOUCHER_SECRET;
    expect(() => validateDeploymentConfiguration(environment)).toThrow(
      "commons: VOUCHER_SECRET is required in production.",
    );
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({ MONGODB_URI: "mongodb://platform/class", VOUCHER_SECRET: "" }),
      ),
    ).toThrow("commons: VOUCHER_SECRET is required in production.");
  });

  test("requires each derivation secret to be long and distinct", () => {
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({
          MONGODB_URI: "mongodb://platform/class",
          VOUCHER_SECRET: "too-short",
        }),
      ),
    ).toThrow("commons: VOUCHER_SECRET must carry at least 32 characters of random data.");
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({
          MONGODB_URI: "mongodb://platform/class",
          INVITATION_SECRET: "too-short",
        }),
      ),
    ).toThrow("commons: INVITATION_SECRET must carry at least 32 characters of random data.");
    expect(() =>
      validateDeploymentConfiguration(
        productionEnvironment({
          MONGODB_URI: "mongodb://platform/class",
          VOUCHER_SECRET: "one-secret-for-both-0123456789abcdef",
          INVITATION_SECRET: "one-secret-for-both-0123456789abcdef",
        }),
      ),
    ).toThrow("commons: VOUCHER_SECRET must differ from INVITATION_SECRET.");
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

test("requires MONGODB_URL", async () => {
  await expect(constructConceptFloor()).rejects.toThrow("commons: MONGODB_URL is required.");
});

test("reads the database name from mongodb:// and mongodb+srv:// URL paths", async () => {
  for (const [url, database] of [
    ["mongodb://127.0.0.1:27017/commons", "commons"],
    [
      "mongodb+srv://operator:credential@cluster.example.test/hosted-commons?retryWrites=true&w=majority",
      "hosted-commons",
    ],
  ]) {
    let supplied = "";
    const floor = await constructConceptFloor(url, async (candidate) => {
      supplied = candidate;
      return new MongoClient(candidate);
    });
    expect(supplied).toBe(url);
    expect(floor.name).toBe("mongo");
    expect(floor.resources).toEqual([`MongoDB database ${database}`]);
    await floor.close();
  }
});

test("requires a valid MongoDB URL with database selection without exposing credentials", async () => {
  for (const [url, message] of [
    [
      "mongodb://operator:missing-database-secret@127.0.0.1:27017",
      "commons: MONGODB_URL must select a database in its path.",
    ],
    [
      "https://operator:invalid-url-secret@127.0.0.1:27017/commons",
      "commons: MONGODB_URL is not a valid MongoDB connection URL.",
    ],
  ]) {
    await expect(constructConceptFloor(url)).rejects.toThrow(message);
    try {
      await constructConceptFloor(url);
    } catch (error) {
      expect(String(error)).not.toContain("secret");
    }
  }
}, 20_000);

test("connection failures redact credentials before startup can log them", async () => {
  await expect(
    constructConceptFloor("mongodb://operator:connection-secret@127.0.0.1:1/commons", async () => {
      throw new Error("connection-secret: simulated driver failure");
    }),
  ).rejects.toThrow("commons: could not connect to the configured MongoDB.");
});
