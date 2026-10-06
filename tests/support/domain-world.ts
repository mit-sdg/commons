import { assemble } from "@mit-sdg/sync-engine/assembly";
import { learningConcepts } from "../../src/concepts.ts";
import type { CommonsApp, CommonsImplementations } from "../../src/assembly/application.ts";
import { composition } from "../../src/compositions/index.ts";
import { createEdgeForApplication } from "../../src/edge.ts";
import {
  liveTransport,
  forumTransport,
  taskTransport,
  productionPaths,
} from "./transport-cache.ts";

for (const modules of Object.values(composition)) {
  for (const exports of Object.values(modules)) {
    for (const declaration of Object.values(exports)) {
      if (
        declaration !== null &&
        typeof declaration === "object" &&
        "path" in declaration &&
        typeof declaration.path === "string" &&
        "reaction" in declaration
      )
        productionPaths.add(declaration.path);
    }
  }
}

/**
 * Retain every production reaction, view, former and original namespace.
 * Only endpoint declarations outside the requested surface are omitted.
 * EndpointDef's public path/reaction shape identifies those declarations.
 */
export function endpointSurface(domains: (keyof typeof composition)[]) {
  return Object.fromEntries(
    Object.entries(composition).map(([domain, modules]) => [
      domain,
      domains.includes(domain as keyof typeof composition)
        ? modules
        : Object.fromEntries(
            Object.entries(modules).map(([name, exports]) => [
              name,
              Object.fromEntries(
                Object.entries(exports).filter(
                  ([, declaration]) =>
                    !(
                      declaration !== null &&
                      typeof declaration === "object" &&
                      "path" in declaration &&
                      typeof declaration.path === "string" &&
                      "reaction" in declaration &&
                      typeof declaration.reaction === "function"
                    ),
                ),
              ),
            ]),
          ),
    ]),
  );
}

/** All production reactions, with the live and identity HTTP surface. */
export function assembleLive(instances: CommonsImplementations, clock?: () => Date): CommonsApp {
  const app = assemble({
    conceptSet: learningConcepts,
    instances,
    composition: endpointSurface(["Access", "Live"]),
    ...(clock === undefined ? {} : { clock }),
  }) as CommonsApp;
  liveTransport.applications.add(app);
  return app;
}

export function createLiveEdge(
  instances: CommonsImplementations,
  origin?: string,
  clock?: () => Date,
) {
  return createEdgeForApplication(assembleLive(instances, clock), instances, origin, clock);
}

export function assembleForum(instances: CommonsImplementations, clock?: () => Date): CommonsApp {
  const app = assemble({
    conceptSet: learningConcepts,
    instances,
    composition: endpointSurface(["Access", "Course", "Forum"]),
    ...(clock === undefined ? {} : { clock }),
  }) as CommonsApp;
  forumTransport.applications.add(app);
  return app;
}

export function createForumEdge(
  instances: CommonsImplementations,
  origin?: string,
  clock?: () => Date,
) {
  return createEdgeForApplication(assembleForum(instances, clock), instances, origin, clock);
}

export function assembleTasks(instances: CommonsImplementations): CommonsApp {
  const app = assemble({
    conceptSet: learningConcepts,
    instances,
    composition: endpointSurface(["Access", "Tasks"]),
  }) as CommonsApp;
  taskTransport.applications.add(app);
  return app;
}
