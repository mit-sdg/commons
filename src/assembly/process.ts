import { createEdge } from "../edge.ts";
import { constructConceptFloor } from "./concept-floor.ts";

export interface CommonsProcessConfiguration {
  port: number;
  mongodbUrl?: string;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runCommonsProcess(configuration: CommonsProcessConfiguration) {
  const { port, mongodbUrl } = configuration;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: port must be an integer from 1 to 65535; received "${port}"`);
  }

  const floor = await constructConceptFloor(mongodbUrl);
  let edge: ReturnType<typeof createEdge>;
  try {
    edge = createEdge(floor.instances);
  } catch (error) {
    await floor.close().catch(() => undefined);
    throw new Error(`commons: could not start Commons: ${messageOf(error)}`);
  }

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({ hostname: "127.0.0.1", port, fetch: edge.fetch });
  } catch (error) {
    await floor.close().catch(() => undefined);
    throw new Error(`commons: could not listen on http://127.0.0.1:${port}: ${messageOf(error)}`);
  }

  const resource = floor.resources.length === 0 ? floor.name : floor.resources.join(", ");
  console.log(`commons: storing concept state in ${resource}.`);
  console.log(`commons: serving ${edge.servedPaths.size} endpoints on http://127.0.0.1:${port}`);

  let stopped = false;
  return {
    edge,
    port,
    floor: floor.name,
    async stop() {
      if (stopped) return;
      stopped = true;
      try {
        await server.stop();
      } finally {
        await floor.close();
      }
      console.log("commons: edge stopped");
    },
  };
}
