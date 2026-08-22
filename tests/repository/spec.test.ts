import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly, renderApp } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import generated from "../../generated.config.ts";

describe("the rendered application specification", () => {
  test("renders every declared construction and computation", async () => {
    const ir = inspectAssembly(assembleCommons(mongoImplementations(await testDb()))).app;
    expect(ir.unlowered ?? []).toEqual([]);
    expect(JSON.stringify(ir).match(/"op":"compute"/g)).toHaveLength(13);
    expect(ir.views).toHaveLength(60);
    expect(ir.formers).toHaveLength(77);
  });

  test("every concept's purpose and principle are authored — zero unwritten stubs", async () => {
    const design = inspectAssembly(assembleCommons(mongoImplementations(await testDb())));
    const spec = renderApp({ title: generated.title, concepts: design.concepts, app: design.app });
    expect(spec).not.toContain("[unwritten");
  });
});

afterAll(stopTestDb);
