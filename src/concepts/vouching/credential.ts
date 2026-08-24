import { createHmac } from "node:crypto";

const DEVELOPMENT_SECRET = "commons-development-only-voucher-secret";

export function voucherCredential(voucher: string): string {
  const secret = process.env.VOUCHER_SECRET ?? DEVELOPMENT_SECRET;
  return `R-${createHmac("sha256", secret)
    .update(`commons-voucher-v1\0${voucher}`)
    .digest("base64url")
    .slice(0, 24)}`;
}
