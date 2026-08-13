import { createHmac } from "node:crypto";

const DEVELOPMENT_SECRET = "commons-development-only-invitation-secret";

export function invitationCredential(invitation: string): string {
  const secret = process.env.INVITATION_SECRET ?? DEVELOPMENT_SECRET;
  return `C-${createHmac("sha256", secret)
    .update(`commons-invitation-v1\0${invitation}`)
    .digest("base64url")
    .slice(0, 24)}`;
}
