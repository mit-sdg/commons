import type { bindTransport } from "@mit-sdg/sync-engine/boundary";

type Binding = ReturnType<typeof bindTransport>;

/** Only immutable declarations are shared; applications and invokers stay fresh. */
function declarations(surface: string) {
  return {
    surface,
    applications: new WeakSet<object>(),
    facts: undefined as Pick<Binding, "routes" | "logicalWire"> | undefined,
  };
}

export const commonsTransport = declarations("commons");
export const liveTransport = declarations("live");

export const forumTransport = declarations("forum");
export const taskTransport = declarations("tasks");

export const productionPaths = new Set<string>();
