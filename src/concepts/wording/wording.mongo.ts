import type { Collection, Db } from "mongodb";
import { InvalidWording } from "./errors.ts";

interface WordingDoc {
  _id: string;
  heading: string;
  passage: string;
}

export const HEADING_LIMIT = 200;
export const PASSAGE_LIMIT = 20_000;

/** One line: no control characters, and neither Unicode line separator. */
const oneLine = (value: string) => !/[\p{Cc}\u2028\u2029]/u.test(value);

export class MongoWordingConcept {
  private readonly wordings: Collection<WordingDoc>;

  constructor(db: Db) {
    this.wordings = db.collection<WordingDoc>("wording.wordings");
  }

  async word({ place, heading, passage }: { place: string; heading: string; passage: string }) {
    const trimmedHeading = heading.trim();
    const trimmedPassage = passage.replace(/\r\n?/g, "\n").trim();
    if (
      !oneLine(heading) ||
      trimmedHeading.length === 0 ||
      trimmedHeading.length > HEADING_LIMIT ||
      passage.includes("\0") ||
      trimmedPassage.length === 0 ||
      trimmedPassage.length > PASSAGE_LIMIT
    ) {
      throw new InvalidWording(
        "Use a one-line heading of up to 200 characters and a passage of up to 20000 characters.",
      );
    }
    const wording = { heading: trimmedHeading, passage: trimmedPassage };
    await this.wordings.updateOne({ _id: place }, { $set: wording }, { upsert: true });
    return wording;
  }

  async withdraw({ place }: { place: string }) {
    await this.wordings.deleteOne({ _id: place });
    return { place };
  }

  async _wordingIn({ place }: { place: string }) {
    const doc = await this.wordings.findOne({ _id: place });
    return doc === null ? [] : [{ heading: doc.heading, passage: doc.passage }];
  }
}
