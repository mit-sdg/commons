import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import type { CommonsOverrides } from "./assembly/application.ts";
import { assembleCommons } from "./assembly/application.ts";
import { commonsHttpPolicy } from "./assembly/http-policy.ts";
import { configuredPublicOrigin } from "./deployment.ts";

const PUBLIC_PATHS = new Set(["/auth/login", "/auth/accept-invitation"]);

function sessionFrom(request: Request): string | undefined {
  const sessions = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("__Host-commons-session="))
    .map((part) => part.slice("__Host-commons-session=".length));
  return sessions.length === 1 && sessions[0] !== "" ? sessions[0] : undefined;
}

export function createEdge(
  overrides: CommonsOverrides = {},
  origin: string = configuredPublicOrigin(),
) {
  const application = assembleCommons(overrides);
  const gateway = createGateway({ application });
  const policy = commonsHttpPolicy(origin);
  const handler = createHttpHandler({ application, gateway, policy });
  const servedPaths = new Set(Object.keys(application.publicInterface.routes));
  const sessionPaths = new Set(
    Object.entries(application.publicInterface.routes)
      .filter(([, contract]) => contract.required?.includes("session"))
      .map(([path]) => path),
  );
  const fetch = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname;
    const logicalPath = path.startsWith("/api/") ? path.slice(4) : undefined;
    if (
      request.method === "POST" &&
      logicalPath !== undefined &&
      servedPaths.has(logicalPath) &&
      !PUBLIC_PATHS.has(logicalPath)
    ) {
      const session = sessionFrom(request);
      const { at } = await application.concepts.Timing._now();
      const active =
        session === undefined
          ? []
          : await application.concepts.Sessioning._getUser({ session, at });
      if (active.length === 0)
        return Response.json(
          { error: "UNAUTHORIZED" },
          {
            status: 401,
            headers: {
              "Cache-Control": "private, no-store",
              "Set-Cookie":
                "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
            },
          },
        );
    }
    const response = await handler(request);
    if (logicalPath !== undefined && !PUBLIC_PATHS.has(logicalPath)) {
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  };

  return {
    application,
    gateway,
    policy,
    fetch,
    servedPaths,
    sessionPaths,
    publicPaths: new Set(PUBLIC_PATHS),
  };
}
