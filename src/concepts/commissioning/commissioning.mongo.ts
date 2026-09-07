import type { Collection, Db } from "mongodb";
import { CommissionNotFound, CommissionNotPrepared } from "./errors.ts";

type Status = "prepared" | "declined" | "accepted" | "completed" | "failed";
interface CommissionDoc {
  _id: string;
  subject: string;
  brief: string;
  status: Status;
  account: string;
  executions: string[];
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  expiresAt?: Date;
}

interface ReceiptDoc {
  _id: string;
  successful: boolean;
  account: string;
  at: Date;
  expiresAt: Date;
}

/** An undertaking survives its admission and links the work to its conclusion. */
export class MongoCommissioningConcept {
  private readonly commissions: Collection<CommissionDoc>;
  private readonly receipts: Collection<ReceiptDoc>;
  private indexes: Promise<unknown> | undefined;

  constructor(db: Db) {
    this.commissions = db.collection<CommissionDoc>("commissioning.commissions");
    this.receipts = db.collection<ReceiptDoc>("commissioning.receipts");
  }

  async #ready() {
    await (this.indexes ??= Promise.all([
      this.commissions.createIndexes([
        { key: { subject: 1, createdAt: -1 } },
        { key: { executions: 1 } },
        { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
      ]),
      this.receipts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    ]));
  }

  async #get(commission: string) {
    const doc = await this.commissions.findOne({ _id: commission });
    if (doc === null) throw new CommissionNotFound("There is no such commission.");
    return doc;
  }

  async prepare({
    subject,
    brief,
    account,
    at,
  }: {
    subject: string;
    brief: string;
    account: string;
    at: Date;
  }) {
    await this.#ready();
    const commission = crypto.randomUUID();
    const status = account === "" ? "prepared" : "declined";
    await this.commissions.insertOne({
      _id: commission,
      subject,
      brief,
      account,
      status,
      executions: [],
      createdAt: at,
      updatedAt: at,
      ...(status === "declined" ? { expiresAt: new Date(at.getTime() + 3_600_000) } : {}),
    });
    return { commission, subject, status, account, brief };
  }

  async accept({ commission, at }: { commission: string; at: Date }) {
    const doc = await this.commissions.findOneAndUpdate(
      { _id: commission, status: "prepared" },
      { $set: { status: "accepted", updatedAt: at, acceptedAt: at } },
      { returnDocument: "after" },
    );
    if (doc === null) {
      await this.#get(commission);
      throw new CommissionNotPrepared("Only a prepared commission can be accepted.");
    }
    return { commission, brief: doc.brief };
  }

  /** Association may arrive after a fast worker finishes; it never reopens work. */
  async assign({ commission, execution, at }: { commission: string; execution: string; at: Date }) {
    const doc = await this.commissions.findOneAndUpdate(
      { _id: commission, acceptedAt: { $exists: true } },
      { $addToSet: { executions: execution }, $set: { updatedAt: at } },
      { returnDocument: "after" },
    );
    if (doc === null) {
      await this.#get(commission);
      throw new CommissionNotPrepared("Only an accepted undertaking can receive an execution.");
    }
    const receipt = await this.receipts.findOne({ _id: execution });
    if (receipt !== null)
      await this.#conclude({
        commission,
        successful: receipt.successful,
        account: receipt.account,
        at: receipt.at,
      });
    return { commission, execution };
  }

  /** A completion receipt can precede its association with an undertaking. */
  async report({
    execution,
    successful,
    account,
    at,
  }: {
    execution: string;
    successful: boolean;
    account: string;
    at: Date;
  }) {
    await this.#ready();
    const receipt = await this.receipts.findOneAndUpdate(
      { _id: execution },
      {
        $setOnInsert: {
          successful,
          account,
          at,
          expiresAt: new Date(at.getTime() + 7 * 86_400_000),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (receipt === null) throw new Error("A recorded receipt must exist.");
    const commissions = await this.commissions
      .find({ executions: execution, status: "accepted" })
      .toArray();
    for (const commission of commissions) {
      await this.#conclude({
        commission: commission._id,
        successful: receipt.successful,
        account: receipt.account,
        at: receipt.at,
      });
    }
    return { execution, successful: receipt.successful, account: receipt.account };
  }

  async _receipt({ execution }: { execution: string }) {
    const doc = await this.receipts.findOne({ _id: execution });
    return doc === null ? [] : [{ successful: doc.successful, account: doc.account, at: doc.at }];
  }

  /** The first conclusion wins; repeated completion signals do not rewrite history. */
  async conclude(input: { commission: string; successful: boolean; account: string; at: Date }) {
    return await this.#conclude(input);
  }

  async #conclude({
    commission,
    successful,
    account,
    at,
  }: {
    commission: string;
    successful: boolean;
    account: string;
    at: Date;
  }) {
    const doc = await this.commissions.findOneAndUpdate(
      { _id: commission, status: { $in: successful ? ["accepted"] : ["prepared", "accepted"] } },
      {
        $set: {
          status: successful ? "completed" : "failed",
          account,
          updatedAt: at,
          expiresAt: new Date(at.getTime() + 7 * 86_400_000),
        },
      },
      { returnDocument: "after" },
    );
    const recorded = doc ?? (await this.#get(commission));
    return { commission, status: recorded.status, account: recorded.account };
  }

  async _commission({ commission }: { commission: string }) {
    const doc = await this.commissions.findOne({ _id: commission });
    return doc === null
      ? []
      : [
          {
            subject: doc.subject,
            brief: doc.brief,
            status: doc.status,
            account: doc.account,
            executions: doc.executions,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
          },
        ];
  }

  async _forExecution({ execution }: { execution: string }) {
    const docs = await this.commissions.find({ executions: execution }).toArray();
    return docs.map((doc) => ({ commission: doc._id, subject: doc.subject, status: doc.status }));
  }

  async _forSubject({ subject }: { subject: string }) {
    const docs = await this.commissions.find({ subject }).sort({ createdAt: -1, _id: 1 }).toArray();
    return docs.map((doc) => ({
      commission: doc._id,
      status: doc.status,
      account: doc.account,
      brief: doc.brief,
      executions: doc.executions,
    }));
  }
}
