import { MailRecipientInvalid } from "./errors.ts";

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+$/;

export function normalizeMailRecipient(recipient: string): string {
  const normalized = recipient.trim().toLowerCase();
  if (!EMAIL_ADDRESS.test(normalized)) throw new MailRecipientInvalid(recipient);
  return normalized;
}
