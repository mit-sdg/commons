import { testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";

export interface WireStep {
  id: string;
  phase: "setup" | "assert";
  kind: "send" | "concept" | "setup";
  target: string;
  body: Record<string, unknown>;
  response: unknown;
}

export interface WireFixture {
  steps: WireStep[];
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const atPath = (value: unknown, path: string[], reference: string): unknown => {
  let found = value;
  for (const key of path) {
    if (found === null || typeof found !== "object") {
      throw new Error(`unresolved reference ${reference}`);
    }
    found = (found as Record<string, unknown>)[key];
  }
  if (found === undefined) throw new Error(`unresolved reference ${reference}`);
  return found;
};

export function resolveWireValue(value: unknown, responses: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    if (/^\$\w+(\.\w+)+$/.test(value)) {
      const [step, ...path] = value.slice(1).split(".");
      return atPath(responses[step], path, value);
    }
    return value.replace(/\$(\w+(?:\.\w+)+)/g, (reference) => {
      const [step, ...path] = reference.slice(1).split(".");
      const found = atPath(responses[step], path, reference);
      if (typeof found !== "string") {
        throw new Error(`embedded reference ${reference} does not name text`);
      }
      return found;
    });
  }
  if (Array.isArray(value)) return value.map((entry) => resolveWireValue(entry, responses));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        resolveWireValue(entry, responses),
      ]),
    );
  }
  return value;
}

export function wireNormalizer() {
  const ids = new Map<string, string>();
  const normalize = (value: unknown): unknown => {
    if (typeof value === "string") {
      const withStableIds = value.replace(UUID, (id) => {
        let label = ids.get(id);
        if (label === undefined) {
          label = `uuid#${ids.size + 1}`;
          ids.set(id, label);
        }
        return label;
      });
      return ISO_DATE.test(withStableIds) ? "<date>" : withStableIds;
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          normalize(entry),
        ]),
      );
    }
    return value;
  };
  return normalize;
}

export async function runWireFixture(fixture: WireFixture) {
  const app = assembleCommons(mongoImplementations(await testDb()));
  const concepts = app.concepts as unknown as Record<
    string,
    Record<string, (input: Record<string, unknown>) => Promise<unknown>>
  >;
  const responses: Record<string, unknown> = {};
  const normalize = wireNormalizer();
  const observed: unknown[] = [];

  for (const step of fixture.steps) {
    const body = resolveWireValue(step.body, responses) as Record<string, unknown>;
    let response: unknown;
    if (step.kind === "setup") {
      if (step.target !== "register-user") throw new Error(`unknown setup action ${step.target}`);
      try {
        const registered = await app.concepts.Authenticating.register({
          username: String(body.username),
          password: String(body.password),
          email: String(body.email),
        });
        if ("error" in registered) {
          response = { error: registered.error };
        } else {
          await app.concepts.Profiling.createProfile({
            user: registered.user,
            displayName: String(body.displayName),
            email: String(body.email),
          });
          response = registered;
        }
      } catch (error) {
        const refusal = error as Error & { code?: string };
        response = { error: refusal.code };
      }
    } else if (step.kind === "concept") {
      const [conceptName, action] = step.target.split(".");
      const member = concepts[conceptName]?.[action];
      if (member === undefined) throw new Error(`unknown concept action ${step.target}`);
      response = await member(body);
    } else {
      const result = await app.invoker.invoke(step.target, body as never);
      response = result.ok
        ? result.value
        : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
    }
    responses[step.id] = response;
    observed.push(normalize(JSON.parse(JSON.stringify(response ?? null))));
  }
  return observed;
}

export function wireScenario(name: string, fixtureUrl: URL) {
  describe(name, () => {
    test("serves every declared response", async () => {
      const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8")) as WireFixture;
      const observed = await runWireFixture(fixture);
      fixture.steps.forEach((step, index) => {
        expect(observed[index], `${step.id} (${step.target})`).toEqual(step.response);
      });
    });
  });
}
