import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEVELOPMENT_SECRET = "commons-development-only-voucher-secret";

export function voucherCredential(voucher: string): string {
  const secret = process.env.VOUCHER_SECRET ?? DEVELOPMENT_SECRET;
  return `R-${createHmac("sha256", secret)
    .update(`commons-voucher-v1\0${voucher}`)
    .digest("base64url")
    .slice(0, 24)}`;
}

/** Compares two texts in time that does not depend on where they first differ. */
export function sameText(left: string, right: string): boolean {
  const digest = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(digest(left), digest(right));
}

/** Absent agrees only with absent; present texts agree when they are equal. */
export function counterpartAgrees(
  held: string | undefined,
  presented: string | null | undefined,
): boolean {
  if (held === undefined) return presented == null;
  return typeof presented === "string" && sameText(held, presented);
}
