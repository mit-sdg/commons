import type { Collection, Db } from "mongodb";
import { SubmissionNotFound, SubmissionNotSubmitted, SubmissionNotWithdrawn } from "./errors.ts";

interface SubmissionDoc {
  _id: string;
  assignment: string;
  submitter: string;
  number: number;
  artifacts: string[];
  submittedAt: Date;
  status: "SUBMITTED" | "WITHDRAWN";
  seq: number;
}

export class MongoSubmittingConcept {
  private readonly submissions: Collection<SubmissionDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db) {
    this.submissions = db.collection<SubmissionDoc>("submitting.submissions");
    this.counters = db.collection("submitting.counters");
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "submissions" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async submit({
    assignment,
    submitter,
    artifact,
    at,
  }: {
    assignment: string;
    submitter: string;
    artifact: string;
    at: Date;
  }) {
    let number = 1;
    const existing = await this.submissions.find({ assignment, submitter }).toArray();
    for (const doc of existing) {
      if (doc.number >= number) number = doc.number + 1;
    }
    const submission = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.submissions.insertOne({
      _id: submission,
      assignment,
      submitter,
      number,
      artifacts: [artifact],
      submittedAt: at,
      status: "SUBMITTED",
      seq,
    });
    return { submission };
  }

  async withdraw({ submission }: { submission: string }) {
    const doc = await this.submissions.findOne({ _id: submission });
    if (doc === null) {
      throw new SubmissionNotFound(submission);
    }
    if (doc.status !== "SUBMITTED") {
      throw new SubmissionNotSubmitted(submission);
    }
    await this.submissions.updateOne({ _id: submission }, { $set: { status: "WITHDRAWN" } });
    return { submission };
  }

  async restore({ submission }: { submission: string }) {
    const doc = await this.submissions.findOne({ _id: submission });
    if (doc === null) {
      throw new SubmissionNotFound(submission);
    }
    if (doc.status !== "WITHDRAWN") {
      throw new SubmissionNotWithdrawn(submission);
    }
    await this.submissions.updateOne({ _id: submission }, { $set: { status: "SUBMITTED" } });
    return { submission };
  }

  #row(doc: SubmissionDoc) {
    return {
      submission: doc._id,
      artifacts: [...doc.artifacts],
      submittedAt: doc.submittedAt,
      number: doc.number,
      status: doc.status,
    };
  }

  async _getLatest({ assignment, submitter }: { assignment: string; submitter: string }) {
    const docs = await this.submissions
      .find({ assignment, submitter, status: "SUBMITTED" })
      .toArray();
    let best: SubmissionDoc | undefined;
    for (const doc of docs) {
      if (best === undefined || doc.number > best.number) best = doc;
    }
    return best === undefined ? [] : [{ latest: this.#row(best) }];
  }

  async _getAttempts({ assignment, submitter }: { assignment: string; submitter: string }) {
    const docs = await this.submissions
      .find({ assignment, submitter })
      .sort({ number: 1 })
      .toArray();
    return docs.map((doc) => this.#row(doc));
  }

  async _getSubmissionsForAssignment({ assignment }: { assignment: string }) {
    const docs = await this.submissions
      .find({ assignment })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      submitter: doc.submitter,
      submission: doc._id,
      artifacts: [...doc.artifacts],
      submittedAt: doc.submittedAt,
      number: doc.number,
      status: doc.status,
    }));
  }

  async _getSubmissionsForSubmitter({ submitter }: { submitter: string }) {
    const docs = await this.submissions
      .find({ submitter })
      .sort({ submittedAt: 1, seq: 1 })
      .toArray();
    return docs.map((doc) => ({
      assignment: doc.assignment,
      submission: doc._id,
      submittedAt: doc.submittedAt,
      number: doc.number,
      status: doc.status,
    }));
  }
}
