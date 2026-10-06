import { afterAll, expect, vi } from "vite-plus/test";
import { setPasswordWorkFactorForTests } from "../../src/concepts/authenticating/password-verifier.ts";

setPasswordWorkFactorForTests(16);

// A separate pool client is not owned by the per-file testDb helper.
afterAll(async () => {
  await pooledLifecycle.release?.();
});

const { commonsTransport, liveTransport, forumTransport, taskTransport, productionPaths } =
  await vi.hoisted(() => import("./transport-cache.ts"));
const { journals, occurrenceSink } = await vi.hoisted(() => import("./occurrences.ts"));
const { pooledLifecycle } = await vi.hoisted(() => import("./world-lifecycle.ts"));

const { edgeBuilders } = await vi.hoisted(() => import("./edge-fixture.ts"));

const { sharedProjection } = await vi.hoisted(() => import("./shared-projections.ts"));

vi.mock("../../src/edge.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/edge.ts")>();
  function tracked(
    edge: ReturnType<typeof actual.createEdge>,
    instances: Parameters<typeof actual.createEdge>[0],
    origin?: string,
    clock?: () => Date,
  ) {
    const app = edge.application;
    if (
      liveTransport.applications.has(app) ||
      forumTransport.applications.has(app) ||
      taskTransport.applications.has(app)
    ) {
      const fetch = edge.fetch;
      edge.fetch = (request) => {
        const path = new URL(request.url).pathname.replace(/^\/api(?=\/)/, "");
        if (productionPaths.has(path) && !edge.servedPaths.has(path))
          throw new Error(`focused fixture omits requested endpoint ${path}`);
        return fetch(request);
      };
    }
    edgeBuilders.set(edge, () =>
      tracked(
        actual.createEdgeForApplication(app, instances, origin, clock),
        instances,
        origin,
        clock,
      ),
    );
    return edge;
  }
  const createEdge: typeof actual.createEdge = (instances, origin, clock) =>
    tracked(actual.createEdge(instances, origin, clock), instances, origin, clock);
  const createEdgeForApplication: typeof actual.createEdgeForApplication = (
    app,
    instances,
    origin,
    clock,
  ) =>
    tracked(
      actual.createEdgeForApplication(app, instances, origin, clock),
      instances,
      origin,
      clock,
    );
  return { ...actual, createEdge, createEdgeForApplication };
});

vi.mock("@mit-sdg/sync-engine/assembly", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mit-sdg/sync-engine/assembly")>();
  const assemble = ((options: Parameters<typeof actual.assemble>[0]) => {
    const path = expect.getState().testPath ?? "";
    if (
      !/(wall-sorting|invitation-enrolment|composition-integrity|forum-trash-recovery|boundary-partitions|trust-floor|occurrences)\.test\.ts$/.test(
        path,
      )
    ) {
      return actual.assemble(options);
    }
    const { records, sink } = occurrenceSink();
    const app = actual.assemble({ ...options, logSink: sink });
    journals.set(app, records);
    return app;
  }) as typeof actual.assemble;
  return { ...actual, assemble };
});

vi.mock("../../src/assembly/application.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/assembly/application.ts")>();
  const assembleCommons: typeof actual.assembleCommons = (...args) => {
    const app = actual.assembleCommons(...args);
    commonsTransport.applications.add(app);
    return app;
  };
  return { ...actual, assembleCommons };
});

vi.mock("@mit-sdg/sync-engine/boundary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mit-sdg/sync-engine/boundary")>();
  const bindTransport: typeof actual.bindTransport = (options) => {
    // Retain the real ownership check and this application's live invoker.
    const binding = actual.bindTransport(options);
    const declarations = commonsTransport.applications.has(options.application)
      ? commonsTransport
      : liveTransport.applications.has(options.application)
        ? liveTransport
        : forumTransport.applications.has(options.application)
          ? forumTransport
          : taskTransport.applications.has(options.application)
            ? taskTransport
            : undefined;
    if (declarations === undefined) return binding;
    declarations.facts ??= sharedProjection(declarations.surface, () =>
      Object.freeze({
        routes: binding.routes,
        logicalWire: binding.logicalWire,
      }),
    );
    return Object.freeze({ ...declarations.facts, invoker: binding.invoker });
  };
  return { ...actual, bindTransport };
});
