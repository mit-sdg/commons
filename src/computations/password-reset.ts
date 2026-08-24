import { configuredPublicOrigin } from "../deployment.ts";

// The mail bodies below promise "one hour" in prose; keep them in step with this value.
const RESET_VALIDITY_MS = 60 * 60 * 1000;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function passwordResetExpiry({ at }: { at: Date }): Date {
  return new Date(at.getTime() + RESET_VALIDITY_MS);
}

function resetLink(voucher: string): string {
  return `${configuredPublicOrigin()}/reset-password?voucher=${encodeURIComponent(voucher)}`;
}

export function passwordResetMailText({
  voucher,
  credential,
  username,
}: {
  voucher: string;
  credential: string;
  username: string;
}): string {
  return `Someone asked to reset the password for ${username} on Commons.\n\nReset your password: ${resetLink(voucher)}\nReset code: ${credential}\n\nThis link expires in one hour. If you did not ask for this, ignore this email; your password is unchanged.`;
}

export function passwordResetMailHtml({
  voucher,
  credential,
  username,
}: {
  voucher: string;
  credential: string;
  username: string;
}): string {
  const link = resetLink(voucher);
  return `<p>Someone asked to reset the password for <strong>${escapeHtml(username)}</strong> on Commons.</p><p><a href="${escapeHtml(link)}">Reset your password</a></p><p>Reset code: <strong>${escapeHtml(credential)}</strong></p><p>This link expires in one hour. If you did not ask for this, ignore this email; your password is unchanged.</p>`;
}
