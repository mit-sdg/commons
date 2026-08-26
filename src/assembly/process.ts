import { createEdge } from "../edge.ts";
import type { MailConfiguration } from "../email/configuration.ts";
import { startMailWorker } from "../email/worker.ts";
import type { ReasonerConfiguration } from "../reasoning/configuration.ts";
import { startReasonerWorker } from "../reasoning/worker.ts";
import { commonsMigrations, runMigrations } from "../migrations/index.ts";
import { constructConceptFloor } from "./concept-floor.ts";

export interface CommonsProcessConfiguration {
  host?: string;
  port: number;
  mongodbUrl?: string;
  mail?: MailConfiguration;
  reasoner?: ReasonerConfiguration;
  bootstrap?: {
    username: string;
    password: string;
    displayName: string;
    email: string;
  };
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function runCommonsProcess(configuration: CommonsProcessConfiguration) {
  const { host = "127.0.0.1", port, mongodbUrl, mail, reasoner, bootstrap } = configuration;
  if (host.trim() === "") throw new Error("commons: host must not be empty");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: port must be an integer from 1 to 65535; received "${port}"`);
  }

  const floor = await constructConceptFloor(mongodbUrl);

  // Stored state is brought up to the current contracts before anything reads or
  // writes it: before the bootstrap registration below, which would otherwise
  // build the unique email index over addresses a migration is about to
  // normalize, and before the server accepts a request that could observe
  // half-migrated state. A blocked migration stops startup with its diagnostic
  // rather than serving a database the application cannot use correctly.
  try {
    await runMigrations(floor.database, commonsMigrations);
  } catch (error) {
    await floor.close().catch(() => undefined);
    throw error;
  }

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
      });
    }
  }

  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({ hostname: host, port, fetch: edge.fetch });
  } catch (error) {
    await floor.close().catch(() => undefined);
    throw new Error(`commons: could not listen on http://${host}:${port}: ${messageOf(error)}`);
  }

  const mailWorker =
    mail === undefined ? undefined : startMailWorker(edge.application.concepts.Mailing, mail);
  const reasonerWorker =
    reasoner === undefined
      ? undefined
      : startReasonerWorker(edge.application.concepts.Reasoning, reasoner);
  const resource = floor.resources.length === 0 ? floor.name : floor.resources.join(", ");
  console.log(`commons: storing concept state in ${resource}.`);
  console.log(
    mailWorker === undefined
      ? "commons: SMTP email is disabled."
      : "commons: SMTP email worker started.",
  );
  console.log(
    reasonerWorker === undefined
      ? "commons: the reasoner is disabled."
      : `commons: ${reasoner?.mode === "scripted" ? "scripted" : reasoner?.model} reasoner worker started.`,
  );
  console.log(`commons: serving ${edge.servedPaths.size} endpoints on http://${host}:${port}`);

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
        await reasonerWorker?.stop();
      } finally {
        await floor.close();
      }
      console.log("commons: edge stopped");
    },
  };
}
