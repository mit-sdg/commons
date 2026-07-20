import { describe, expect, test } from "vite-plus/test";
import { inspectAssembly, renderApp } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import generated from "../../generated.config.ts";

describe("the rendered application specification", () => {
  test("renders every declared construction with no unlowered reactions or compute operations", () => {
    const ir = inspectAssembly(assembleCommons()).app;
    expect(ir.unlowered ?? []).toEqual([]);
    expect(JSON.stringify(ir)).not.toContain('"op":"compute"');
    expect(ir.views).toHaveLength(49);
    expect(ir.formers).toHaveLength(66);
  });

  test("every concept's purpose and principle are authored — zero unwritten stubs", () => {
    const design = inspectAssembly(assembleCommons());
    const spec = renderApp({ title: generated.title, concepts: design.concepts, app: design.app });
    expect(spec).not.toContain("[unwritten");
  });
});
