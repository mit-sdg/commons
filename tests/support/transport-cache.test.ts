import { afterAll, expect, test, vi } from "vite-plus/test";
import { bindTransport } from "@mit-sdg/sync-engine/boundary";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

test("cached declarations agree with fresh projections and retain separate live invokers", async () => {
  const native = await vi.importActual<typeof import("@mit-sdg/sync-engine/boundary")>(
    "@mit-sdg/sync-engine/boundary",
  );
  const first = createEdge(mongoImplementations(await testDb()));
  const second = createEdge(
    mongoImplementations(await testDb()),
    "https://other.test",
    () => new Date(),
  );
  const one = native.bindTransport({ application: first.application, gateway: first.gateway });
  const two = native.bindTransport({ application: second.application, gateway: second.gateway });
  expect(two.logicalWire).toEqual(one.logicalWire);
  const cached = bindTransport({ application: second.application, gateway: second.gateway });
  expect(cached.logicalWire).toEqual(two.logicalWire);
  expect(cached.routes).toEqual(two.routes);
  expect(() => bindTransport({ application: second.application, gateway: first.gateway })).toThrow(
    "gateway must target the supplied application",
  );
  const { user } = await first.application.concepts.Authenticating.register({
    username: "cache-owner",
    password: "password123",
    email: "cache@example.test",
  });
  await first.application.concepts.Profiling.createProfile({ user, displayName: "Cache owner" });
  const { session } = await first.application.concepts.Sessioning.start({ user });
  const request = () =>
    new Request("https://commons.test/api/auth/me", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `__Host-commons-session=${session}` },
      body: "{}",
    });
  expect((await second.fetch(request())).status).toBe(401);
  const accepted = await first.fetch(request());
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toMatchObject({ username: "cache-owner" });
});

test("focused surfaces retain every production reaction and preserve native route declarations", async () => {
  const native = await vi.importActual<typeof import("@mit-sdg/sync-engine/boundary")>(
    "@mit-sdg/sync-engine/boundary",
  );
  const { assembleLive, assembleForum, assembleTasks, endpointSurface } =
    await import("./domain-world.ts");
  const { createEdgeForApplication } = await import("../../src/edge.ts");
  const { composition } = await import("../../src/compositions/index.ts");
  for (const domains of [
    ["Access", "Live"],
    ["Access", "Course", "Forum"],
    ["Access", "Tasks"],
  ] as const) {
    const selected = endpointSurface([...domains]);
    for (const [domain, modules] of Object.entries(composition)) {
      for (const [module, exports] of Object.entries(modules)) {
        for (const [name, declaration] of Object.entries(exports)) {
          const endpoint =
            declaration !== null &&
            typeof declaration === "object" &&
            "path" in declaration &&
            "reaction" in declaration;
          if (!endpoint || domains.includes(domain as never)) {
            expect(
              (selected[domain] as Record<string, Record<string, unknown>>)[module][name],
            ).toBe(declaration);
          }
        }
      }
    }
  }
  const full = createEdge(mongoImplementations(await testDb()));
  const { inspectAssembly } = await import("@mit-sdg/sync-engine/tooling");
  const reactive = (app: ReturnType<typeof createEdge>["application"]) =>
    (() => {
      const ir = inspectAssembly(app).app;
      return {
        reactions: ir.reactions.filter((reaction) => reaction.authored?.source !== "endpoint"),
        unlowered: ir.unlowered.filter((reaction) => reaction.authored?.source !== "endpoint"),
        views: ir.views.toSorted((a, b) => a.name.localeCompare(b.name)),
        formers: ir.formers.toSorted((a, b) => a.name.localeCompare(b.name)),
      };
    })();
  const fullBinding = native.bindTransport({
    application: full.application,
    gateway: full.gateway,
  });
  // Native wire derivation materializes lazy former inventories before comparison.
  void fullBinding.logicalWire;
  const fullReactions = reactive(full.application);
  for (const assemble of [assembleLive, assembleForum, assembleTasks]) {
    const instances = mongoImplementations(await testDb());
    const application = assemble(instances);
    const edge = createEdgeForApplication(application, instances);
    const expected = native.bindTransport({ application, gateway: edge.gateway });
    void expected.logicalWire;
    const selected = reactive(application);
    expect(selected.reactions).toEqual(fullReactions.reactions);
    expect(selected.unlowered).toEqual(fullReactions.unlowered);
    // Read inventories are lazy: compare every shared materialized definition,
    // and separately assert that all authored exports are retained by identity.
    for (const kind of ["views", "formers"] as const) {
      const full = new Map(fullReactions[kind].map((definition) => [definition.name, definition]));
      for (const definition of selected[kind]) {
        const expected = full.get(definition.name);
        if (expected !== undefined) expect(definition, definition.name).toEqual(expected);
      }
    }
    const cached = bindTransport({ application, gateway: edge.gateway });
    expect(cached.routes).toEqual(expected.routes);
    expect(cached.logicalWire).toEqual(expected.logicalWire);
    expect(expected.logicalWire.appWide).toEqual(fullBinding.logicalWire.appWide);
    for (const endpoint of expected.logicalWire.endpoints) {
      expect(endpoint, endpoint.path).toEqual(
        fullBinding.logicalWire.endpoints.find((full) => full.path === endpoint.path),
      );
    }
    expect(() =>
      edge.fetch(
        new Request(
          `https://commons.test/api${assemble === assembleLive ? "/tasks/create" : "/live/runs/launch"}`,
          { method: "POST" },
        ),
      ),
    ).toThrow("focused fixture omits requested endpoint");
    for (const [path, declaration] of Object.entries(expected.routes)) {
      expect(declaration, path).toEqual(fullBinding.routes[path]);
    }
  }
});
