import { createEdge } from "../edge.ts";
import type { MailConfiguration } from "../email/configuration.ts";
import { startMailWorker } from "../email/worker.ts";
import { constructConceptFloor } from "./concept-floor.ts";

export interface CommonsProcessConfiguration {
  port: number;
  mongodbUrl?: string;
  mail?: MailConfiguration;
  bootstrap?: {
    username: string;
    password: string;
    displayName: string;
    email: string;
  };
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runCommonsProcess(configuration: CommonsProcessConfiguration) {
  const { port, mongodbUrl, mail, bootstrap } = configuration;
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

  if (bootstrap !== undefined) {
    const existing = await edge.application.concepts.Authenticating._getByUsername({
      username: bootstrap.username,
    });
    if (existing.length === 0) {
      const registered = await edge.application.concepts.Authenticating.register(bootstrap);
      await edge.application.concepts.Profiling.createProfile({
        user: registered.user,
        displayName: bootstrap.displayName,
        email: bootstrap.email,
      });
    }
  }

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({ hostname: "127.0.0.1", port, fetch: edge.fetch });
  } catch (error) {
    await floor.close().catch(() => undefined);
    throw new Error(`commons: could not listen on http://127.0.0.1:${port}: ${messageOf(error)}`);
  }

  const mailWorker =
    mail === undefined ? undefined : startMailWorker(edge.application.concepts.Mailing, mail);
  const resource = floor.resources.length === 0 ? floor.name : floor.resources.join(", ");
  console.log(`commons: storing concept state in ${resource}.`);
  console.log(
    mailWorker === undefined
      ? "commons: SMTP email is disabled."
      : "commons: SMTP email worker started.",
  );
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
        await mailWorker?.stop();
      } finally {
        await floor.close();
      }
      console.log("commons: edge stopped");
    },
  };
}
