import { configuredPublicOrigin } from "../deployment.ts";
import { mailCredential, mailDocument, mailParagraphs } from "../presentation/mail.ts";

// The mail bodies below promise "one hour" in prose; keep them in step with this value.
const RESET_VALIDITY_MS = 60 * 60 * 1000;

// A second request inside this window reuses nothing and sends nothing, so a
// stranger cannot turn the public endpoint into a mail cannon.
const RESET_COOLDOWN_MS = 5 * 60 * 1000;

export function passwordResetExpiry({ at }: { at: Date }): Date {
  return new Date(at.getTime() + RESET_VALIDITY_MS);
}

export function passwordResetCooldownStart({ at }: { at: Date }): Date {
  return new Date(at.getTime() - RESET_COOLDOWN_MS);
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
  return mailDocument({
    title: "Reset your Commons password",
    facts: [["Account", username]],
    bodyHtml:
      mailParagraphs("Someone asked to reset the password for this account on Commons.") +
      mailCredential("Reset code", credential),
    note: "This link expires in one hour. If you did not ask for this, ignore this email; your password is unchanged.",
    action: { label: "Reset your password", url: resetLink(voucher) },
  });
}
