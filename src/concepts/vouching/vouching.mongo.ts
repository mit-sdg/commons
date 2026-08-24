import type { Collection, Db } from "mongodb";
import { voucherCredential } from "./credential.ts";
import { VoucherExpiryInvalid, VoucherInvalid } from "./errors.ts";

interface VoucherDoc {
  _id: string;
  subject: string;
  issuedAt: Date;
  expiresAt: Date;
}

export class MongoVouchingConcept {
  private readonly vouchers: Collection<VoucherDoc>;
  private index: Promise<string> | undefined;

  constructor(db: Db) {
    this.vouchers = db.collection<VoucherDoc>("vouching.vouchers");
  }

  async issue({ subject, at, expiresAt }: { subject: string; at: Date; expiresAt: Date }) {
    await (this.index ??= this.vouchers.createIndex({ subject: 1 }));
    if (expiresAt.getTime() <= at.getTime()) {
      throw new VoucherExpiryInvalid(subject);
    }
    await this.vouchers.deleteMany({ subject, expiresAt: { $lte: at } });
    const voucher = crypto.randomUUID();
    await this.vouchers.insertOne({ _id: voucher, subject, issuedAt: at, expiresAt });
    return { voucher, subject, credential: voucherCredential(voucher) };
  }

  async verify({ voucher, credential, at }: { voucher: string; credential: string; at: Date }) {
    if (voucherCredential(voucher) !== credential) {
      throw new VoucherInvalid(voucher);
    }
    const doc = await this.vouchers.findOne({ _id: voucher, expiresAt: { $gt: at } });
    if (doc === null) throw new VoucherInvalid(voucher);
    return { voucher, subject: doc.subject };
  }

  async redeem({ voucher, credential, at }: { voucher: string; credential: string; at: Date }) {
    if (voucherCredential(voucher) !== credential) {
      throw new VoucherInvalid(voucher);
    }
    const doc = await this.vouchers.findOneAndDelete({ _id: voucher, expiresAt: { $gt: at } });
    if (doc === null) throw new VoucherInvalid(voucher);
    await this.vouchers.deleteMany({ subject: doc.subject });
    return { voucher, subject: doc.subject };
  }

  async _getForSubject({ subject }: { subject: string }) {
    return (await this.vouchers.find({ subject }).sort({ issuedAt: -1 }).toArray()).map((doc) => ({
      voucher: doc._id,
      issuedAt: doc.issuedAt,
      expiresAt: doc.expiresAt,
    }));
  }
}
