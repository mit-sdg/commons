import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Vouching.md" with { type: "text" };
import { VoucherExpiryInvalid, VoucherInvalid } from "./errors.ts";
import { MongoVouchingConcept } from "./vouching.mongo.ts";

export const vouching = registerConcept({
  class: MongoVouchingConcept,
  spec,
  refusals: {
    VOUCHER_INVALID: VoucherInvalid,
    VOUCHER_EXPIRY_INVALID: VoucherExpiryInvalid,
  },
  floors: {
    mongo: ({ database }: { database: Db }, instance: string) =>
      new MongoVouchingConcept(database, instance),
  },
});
