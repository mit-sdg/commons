import { forumMailEligibility } from "../email/forum-policy.ts";
import { createEdge } from "../edge.ts";
import type { MailConfiguration } from "../email/configuration.ts";
import { startMailWorker } from "../email/worker.ts";
import type { ReasonerConfiguration } from "../reasoning/configuration.ts";
import { startParticipantWorker } from "../reasoning/participant.ts";
import { startReasonerWorker } from "../reasoning/worker.ts";
import { commonsMigrations, runMigrations } from "../migrations/index.ts";
import type { Db } from "mongodb";
import { constructConceptFloor } from "./concept-floor.ts";
import { slowRequestLog } from "./slow-requests.ts";

export interface CommonsProcessConfiguration {
  host?: string;
  port: number;
  mongodbUrl?: string;
  /** Requests that take this many milliseconds or longer are logged; unset, none are. */
  slowRequestMs?: number;
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

/**
 * Time a few pings so the log records how far away MongoDB is. A page's time
 * grows with this round trip, so it is the number to read beside slow requests.
 */
async function roundTrip(database: Db, pings = 20): Promise<string> {
  try {
    await database.command({ ping: 1 });
    const times: number[] = [];
    for (let ping = 0; ping < pings; ping += 1) {
      const start = performance.now();
      await database.command({ ping: 1 });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const at = (share: number) => times[Math.max(0, Math.ceil(share * pings) - 1)].toFixed(1);
    return `commons: a MongoDB round trip takes ${at(0.5)} ms (median), ${at(0.95)} ms (95th percentile) over ${pings} pings.`;
  } catch (error) {
    return `commons: could not time a MongoDB round trip: ${messageOf(error)}`;
  }
}

/**
 * The pool's size and idle timeout come from the connection string; on the
 * platform the storage binding sets both, so the log is where to read them.
 */
export function poolLine({ maxSize, idleMs }: { maxSize: number; idleMs: number }): string {
  const idle =
    idleMs > 0
      ? `closes those idle for ${idleMs % 1000 === 0 ? `${idleMs / 1000} s` : `${idleMs} ms`}`
      : "keeps idle ones open";
  return `commons: the MongoDB pool opens up to ${maxSize} connections and ${idle}.`;
}

export async function runCommonsProcess(configuration: CommonsProcessConfiguration) {
  const {
    host = "127.0.0.1",
    port,
    mongodbUrl,
    slowRequestMs,
    mail,
    reasoner,
    bootstrap,
  } = configuration;
  if (host.trim() === "") throw new Error("commons: host must not be empty");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: port must be an integer from 1 to 65535; received "${port}"`);
  }

  const slowRequests = slowRequestMs === undefined ? undefined : slowRequestLog(slowRequestMs);
  const floor = await constructConceptFloor(mongodbUrl, undefined, slowRequests?.observe);

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
    edge = createEdge(floor.instances, undefined, undefined, slowRequests);
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
    mail === undefined
      ? undefined
      : startMailWorker(
          edge.application.concepts.Mailing,
          mail,
          undefined,
          2_000,
          forumMailEligibility(edge.application),
        );
  // Without a reasoner the worker still runs, failing every ask at once.
  const reasonerWorker = startReasonerWorker(edge.application.concepts.Reasoning, reasoner);
  const participantWorker =
    reasoner === undefined ? undefined : startParticipantWorker(edge.application.concepts);
  const resource = floor.resources.length === 0 ? floor.name : floor.resources.join(", ");
  console.log(`commons: storing concept state in ${resource}.`);
  if (floor.pool !== undefined) console.log(poolLine(floor.pool));
  console.log(await roundTrip(floor.database));
  console.log(
    slowRequests === undefined
      ? "commons: slow-request logging is off."
      : `commons: logging requests that take ${slowRequests.thresholdMs} ms or longer.`,
  );
  console.log(
    mailWorker === undefined
      ? "commons: SMTP email is disabled."
      : "commons: SMTP email worker started.",
  );
  console.log(
    reasoner === undefined
      ? "commons: the reasoner is disabled; every ask fails at once."
      : `commons: ${reasoner.mode === "scripted" ? "scripted" : reasoner.model} reasoner worker started.`,
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
        await reasonerWorker.stop();
        await participantWorker?.stop();
      } finally {
        await floor.close();
      }
      console.log("commons: edge stopped");
    },
  };
}
