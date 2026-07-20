import { createGateway, createHttpHandler } from "@mit-sdg/sync-engine/boundary";
import type { CommonsOverrides } from "./assembly/application.ts";
import { assembleCommons } from "./assembly/application.ts";
import { commonsHttpFloor } from "./assembly/http-floor.ts";

function configuredOrigin(): string {
  const origin = process.env.PUBLIC_ORIGIN;
  if (process.env.NODE_ENV === "production" && origin === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  return origin ?? "http://127.0.0.1:3000";
}

export function createEdge(overrides: CommonsOverrides = {}, origin: string = configuredOrigin()) {
  const application = assembleCommons(overrides);
  const gateway = createGateway({ application });
  const floor = commonsHttpFloor(origin);
  const fetch = createHttpHandler({ application, gateway, floor });
  const servedPaths = new Set(Object.keys(application.publicInterface.routes));
  const sessionPaths = new Set(
    Object.entries(application.publicInterface.routes)
      .filter(([, contract]) => contract.required?.includes(floor.credential.input))
      .map(([path]) => path),
  );

  return { application, gateway, floor, fetch, servedPaths, sessionPaths };
}
