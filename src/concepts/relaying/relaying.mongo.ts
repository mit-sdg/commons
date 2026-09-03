import type { Collection, Db } from "mongodb";
import {
  ForwardDraw,
  InvalidShape,
  InvalidTitle,
  LegDrawnOn,
  LegNotFound,
  NoDraw,
  NoSuchPosition,
  NotSiblings,
  RelayNotFound,
} from "./errors.ts";

const TITLE_LIMIT = 200;

/** A title is trimmed first and is valid when it is nonblank and no longer than 200 characters. */
function normalizedTitle(title: string): string {
  const normalized = typeof title === "string" ? title.trim() : "";
  if (normalized === "" || normalized.length > TITLE_LIMIT) {
    throw new InvalidTitle("The title must be 1 to 200 characters long.");
  }
  return normalized;
}

interface RelayDoc {
  _id: string;
  author: string;
  title: string;
  createdAt: Date;
  seq: number;
}

interface LegDoc {
  _id: string;
  relay: string;
  material: string;
  position: number;
}

interface DrawDoc {
  _id: string;
  leg: string;
  source: string;
  shape: string;
  /** Fixed when the draw was made, so drawing again on the same source keeps its place. */
  seq: number;
}

export class MongoRelayingConcept {
  private readonly relays: Collection<RelayDoc>;
  private readonly legs: Collection<LegDoc>;
  private readonly draws: Collection<DrawDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.relays = db.collection<RelayDoc>("relaying.relays");
    this.legs = db.collection<LegDoc>("relaying.legs");
    this.draws = db.collection<DrawDoc>("relaying.draws");
    this.counters = db.collection("relaying.counters");
  }

  async #nextSeq(name: string): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: name },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async plan({ author, title, at }: { author: string; title: string; at: Date }) {
    const normalized = normalizedTitle(title);
    const relay = crypto.randomUUID();
    const seq = await this.#nextSeq("relays");
    await this.relays.insertOne({ _id: relay, author, title: normalized, createdAt: at, seq });
    return { relay };
  }

  async retitle({ relay, title }: { relay: string; title: string }) {
    const doc = await this.relays.findOne({ _id: relay });
    if (doc === null) {
      throw new RelayNotFound("There is no such relay.");
    }
    const normalized = normalizedTitle(title);
    await this.relays.updateOne({ _id: relay }, { $set: { title: normalized } });
    return { relay };
  }

  async addLeg({ relay, material }: { relay: string; material: string }) {
    const doc = await this.relays.findOne({ _id: relay });
    if (doc === null) {
      throw new RelayNotFound("There is no such relay.");
    }
    const position = (await this.legs.countDocuments({ relay })) + 1;
    const leg = crypto.randomUUID();
    await this.legs.insertOne({ _id: leg, relay, material, position });
    return { leg, position };
  }

  async removeLeg({ leg }: { leg: string }) {
    const doc = await this.legs.findOne({ _id: leg });
    if (doc === null) {
      throw new LegNotFound("There is no such leg.");
    }
    const drawnOn = await this.draws.findOne({ source: leg });
    if (drawnOn !== null) {
      throw new LegDrawnOn("Another leg still draws on this one.");
    }
    await this.draws.deleteMany({ leg });
    await this.legs.deleteOne({ _id: leg });
    await this.legs.updateMany(
      { relay: doc.relay, position: { $gt: doc.position } },
      { $inc: { position: -1 } },
    );
    return { leg, relay: doc.relay, material: doc.material };
  }

  async moveLeg({ leg, position }: { leg: string; position: number }) {
    const doc = await this.legs.findOne({ _id: leg });
    if (doc === null) {
      throw new LegNotFound("There is no such leg.");
    }
    const siblings = await this.legs.find({ relay: doc.relay }).toArray();
    if (!Number.isInteger(position) || position < 1 || position > siblings.length) {
      throw new NoSuchPosition("There is no such place in this relay.");
    }
    if (position === doc.position) return { leg, position };

    const from = doc.position;
    const placed = new Map<string, number>();
    for (const sibling of siblings) {
      let place = sibling.position;
      if (sibling._id === leg) place = position;
      else if (position < from && place >= position && place < from) place += 1;
      else if (position > from && place > from && place <= position) place -= 1;
      placed.set(sibling._id, place);
    }

    const drawn = await this.draws.find({ leg: { $in: [...placed.keys()] } }).toArray();
    for (const draw of drawn) {
      const source = placed.get(draw.source);
      const target = placed.get(draw.leg);
      if (source === undefined || target === undefined) continue;
      if (source >= target) {
        throw new ForwardDraw("A leg cannot come before what it draws on.");
      }
    }

    await this.legs.bulkWrite(
      [...placed].map(([id, place]) => ({
        updateOne: { filter: { _id: id }, update: { $set: { position: place } } },
      })),
    );
    return { leg, position };
  }

  async draw({ leg, source, shape }: { leg: string; source: string; shape: string }) {
    const target = await this.legs.findOne({ _id: leg });
    const origin = await this.legs.findOne({ _id: source });
    if (target === null || origin === null) {
      throw new LegNotFound("There is no such leg.");
    }
    if (target.relay !== origin.relay) {
      throw new NotSiblings("These legs do not share a relay.");
    }
    if (origin.position >= target.position) {
      throw new ForwardDraw("A leg cannot come before what it draws on.");
    }
    if (shape.trim() === "") {
      throw new InvalidShape("A draw needs a shape.");
    }
    const standing = await this.draws.findOne({ leg });
    if (standing !== null) {
      await this.draws.updateOne({ _id: standing._id }, { $set: { source, shape } });
      return { draw: standing._id };
    }
    const draw = crypto.randomUUID();
    const seq = await this.#nextSeq("draws");
    await this.draws.insertOne({ _id: draw, leg, source, shape, seq });
    return { draw };
  }

  async undraw({ leg, source }: { leg: string; source: string }) {
    const removed = await this.draws.deleteOne({ leg, source });
    if (removed.deletedCount === 0) {
      throw new NoDraw("This leg does not draw on that one.");
    }
    return { leg };
  }

  async _relay({ relay }: { relay: string }) {
    const doc = await this.relays.findOne({ _id: relay });
    return doc === null ? [] : [{ author: doc.author, title: doc.title, createdAt: doc.createdAt }];
  }

  async _relays(_: Record<string, never>) {
    const docs = await this.relays.find({}).sort({ createdAt: -1, seq: -1 }).toArray();
    return docs.map((doc) => ({
      relay: doc._id,
      author: doc.author,
      title: doc.title,
      createdAt: doc.createdAt,
    }));
  }

  async _legs({ relay }: { relay: string }) {
    const docs = await this.legs.find({ relay }).sort({ position: 1 }).toArray();
    return docs.map((doc) => ({ leg: doc._id, material: doc.material, position: doc.position }));
  }

  async _leg({ leg }: { leg: string }) {
    const doc = await this.legs.findOne({ _id: leg });
    return doc === null
      ? []
      : [{ relay: doc.relay, material: doc.material, position: doc.position }];
  }

  async _legFor({ material }: { material: string }) {
    const doc = await this.legs.findOne({ material });
    return doc === null ? [] : [{ leg: doc._id, relay: doc.relay, position: doc.position }];
  }

  async _draws({ leg }: { leg: string }) {
    const docs = await this.draws.find({ leg }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ draw: doc._id, source: doc.source, shape: doc.shape }));
  }

  async _drawsOn({ source }: { source: string }) {
    const docs = await this.draws.find({ source }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ draw: doc._id, leg: doc.leg, shape: doc.shape }));
  }

  async _plan({ relay }: { relay: string }) {
    const doc = await this.relays.findOne({ _id: relay });
    if (doc === null) return [];
    const legs = await this.legs.find({ relay }).sort({ position: 1 }).toArray();
    const drawn = await this.draws
      .find({ leg: { $in: legs.map((leg) => leg._id) } })
      .sort({ seq: 1 })
      .toArray();
    return [
      {
        legs: legs.map((leg) => ({
          leg: leg._id,
          material: leg.material,
          position: leg.position,
          draws: drawn
            .filter((draw) => draw.leg === leg._id)
            .map((draw) => ({ source: draw.source, shape: draw.shape })),
        })),
      },
    ];
  }
}
