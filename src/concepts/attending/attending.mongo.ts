import type { Collection, Db, IndexDescription } from "mongodb";
import { NotAttending } from "./errors.ts";

interface AttendanceDoc {
  gathering: string;
  attendee: string;
  holding: string;
  heardAt: Date;
}

const GRAIN_MS = 20_000;

const ATTENDANCE_INDEXES: IndexDescription[] = [
  { name: "one_attendance_per_attendee", key: { gathering: 1, attendee: 1 }, unique: true },
  { name: "attendance_expiry", key: { heardAt: 1 }, expireAfterSeconds: 86_400 },
];

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11_000;
}

export class MongoAttendingConcept {
  private readonly attendances: Collection<AttendanceDoc>;
  private indexes: Promise<string[]> | undefined;

  constructor(db: Db) {
    this.attendances = db.collection<AttendanceDoc>("attending.attendances");
  }

  async #ready(): Promise<void> {
    await (this.indexes ??= this.attendances.createIndexes(ATTENDANCE_INDEXES));
  }

  async attend({
    gathering,
    attendee,
    holding,
    at,
  }: {
    gathering: string;
    attendee: string;
    holding: string;
    at: Date;
  }) {
    await this.#ready();
    const heard = {
      $or: [
        { $lte: ["$heardAt", { $literal: new Date(at.getTime() - GRAIN_MS) }] },
        {
          $and: [
            { $ne: ["$holding", { $literal: holding }] },
            { $lt: ["$heardAt", { $literal: at }] },
          ],
        },
      ],
    };
    const checkIn = () =>
      this.attendances.updateOne(
        { gathering, attendee },
        [
          {
            $set: {
              holding: { $cond: [heard, { $literal: holding }, "$holding"] },
              heardAt: { $cond: [heard, { $literal: at }, "$heardAt"] },
            },
          },
        ],
        { upsert: true },
      );
    try {
      await checkIn();
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      await checkIn();
    }
    return { attendee };
  }

  async leave({ gathering, attendee }: { gathering: string; attendee: string }) {
    const leaving = await this.attendances.deleteOne({ gathering, attendee });
    if (leaving.deletedCount === 0) throw new NotAttending("This participant is not here.");
    return { attendee };
  }

  async _present({ gathering, since }: { gathering: string; since: Date }) {
    const docs = await this.attendances
      .find({ gathering, heardAt: { $gte: since } })
      .sort({ attendee: 1 })
      .toArray();
    return docs.map((doc) => ({
      attendee: doc.attendee,
      holding: doc.holding,
      heardAt: doc.heardAt,
    }));
  }
}
