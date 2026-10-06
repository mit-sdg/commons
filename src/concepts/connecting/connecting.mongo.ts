import type { Collection, Db, IndexDescription } from "mongodb";
import { ConnectionNotFound } from "./errors.ts";

interface ConnectionDoc {
  _id: string;
  user: string;
  app: string;
  approvedAt: Date;
}

const CONNECTION_INDEXES: IndexDescription[] = [
  { name: "one_connection_per_app", key: { user: 1, app: 1 }, unique: true },
];

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class MongoConnectingConcept {
  private readonly connections: Collection<ConnectionDoc>;
  private indexes: Promise<string[]> | undefined;

  constructor(db: Db) {
    this.connections = db.collection<ConnectionDoc>("connecting.connections");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.connections.createIndexes(CONNECTION_INDEXES));
  }

  async approve({ user, app, at }: { user: string; app: string; at: Date }) {
    await this.#ready();
    // Only an insert writes, so a standing connection keeps its identity and first approval.
    const record = () =>
      this.connections.findOneAndUpdate(
        { user, app },
        { $setOnInsert: { _id: crypto.randomUUID(), approvedAt: at } },
        { upsert: true, returnDocument: "after" },
      );
    let doc: ConnectionDoc | null;
    try {
      doc = await record();
    } catch (error) {
      // Two approvals racing to insert: the loser finds the winner's connection.
      if (!isDuplicateKey(error)) throw error;
      doc = await record();
    }
    if (doc === null) throw new Error(`connecting: approval of ${app} was not recorded`);
    return { connection: doc._id };
  }

  async withdraw({ connection }: { connection: string }) {
    const removed = await this.connections.findOneAndDelete({ _id: connection });
    if (removed === null) throw new ConnectionNotFound(connection);
    return { connection };
  }

  async _getConnection({ connection }: { connection: string }) {
    const doc = await this.connections.findOne({ _id: connection });
    return doc === null ? [] : [{ user: doc.user, app: doc.app, approvedAt: doc.approvedAt }];
  }

  async _getApproval({ user, app }: { user: string; app: string }) {
    const doc = await this.connections.findOne({ user, app });
    return doc === null ? [] : [{ connection: doc._id, approvedAt: doc.approvedAt }];
  }

  async _getConnections({ user }: { user: string }) {
    const docs = await this.connections.find({ user }).sort({ approvedAt: -1, app: 1 }).toArray();
    return docs.map((doc) => ({ connection: doc._id, app: doc.app, approvedAt: doc.approvedAt }));
  }
}
