import type { Db } from "mongodb";

/**
 * One forward-only change to stored state.
 *
 * A migration exists because a release changed what stored documents must look
 * like, and an already-running deployment cannot be re-seeded. Migrations are
 * forward-only on purpose: Commons has no operation that un-renames a role
 * context or un-normalizes an address, so a reversal would be a new migration
 * rather than an undo of this one.
 */
export interface Migration {
  /** Timestamped, sortable, and permanent once released. */
  readonly id: string;
  /** Why this migration exists, in one line, for the startup log. */
  readonly description: string;
  /**
   * Apply the change. Must be safe to run against a database that is already
   * correct, because the ledger is an optimisation rather than a guarantee: a
   * process that dies after applying but before recording will run it again.
   */
  up(database: Db): Promise<MigrationOutcome>;
}

export interface MigrationOutcome {
  /** What changed, for the startup log. Empty when there was nothing to do. */
  readonly summary: string;
  /**
   * Set when the migration found state it must not repair on its own. Startup
   * stops and prints this instead of serving, because every alternative —
   * guessing, or serving a database the application cannot use — is worse.
   */
  readonly blocked?: string;
}

const LEDGER = "commons.migrations";

interface LedgerDoc {
  _id: string;
  appliedAt: Date;
  summary: string;
}

export class MigrationBlocked extends Error {
  constructor(
    readonly id: string,
    detail: string,
  ) {
    super(`commons: migration ${id} cannot run automatically.\n${detail}`);
    this.name = "MigrationBlocked";
  }
}

/**
 * Apply every migration the ledger has not recorded, oldest first.
 *
 * This runs before the edge serves and before any bootstrap registration, so a
 * request never observes half-migrated state and `Authenticating.register` never
 * builds its unique email index over addresses this run is about to normalize.
 */
export async function runMigrations(
  database: Db,
  migrations: readonly Migration[],
  log: (message: string) => void = console.log,
): Promise<void> {
  const ledger = database.collection<LedgerDoc>(LEDGER);
  const applied = new Set(
    (await ledger.find({}, { projection: { _id: 1 } }).toArray()).map((row) => row._id),
  );
  const pending = migrations.filter((migration) => !applied.has(migration.id));
  if (pending.length === 0) {
    log("commons: no migrations pending.");
    return;
  }

  log(`commons: applying ${pending.length} migration(s) to stored state.`);
  for (const migration of pending) {
    const outcome = await migration.up(database);
    if (outcome.blocked !== undefined) {
      throw new MigrationBlocked(migration.id, outcome.blocked);
    }
    await ledger.updateOne(
      { _id: migration.id },
      { $set: { appliedAt: new Date(), summary: outcome.summary } },
      { upsert: true },
    );
    log(`commons: ${migration.id} — ${outcome.summary}`);
  }
}
