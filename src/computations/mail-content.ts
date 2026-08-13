import { configuredPublicOrigin } from "../deployment.ts";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function invitationLink(invitation: string): string {
  return `${configuredPublicOrigin()}/register?invitation=${encodeURIComponent(invitation)}`;
}

export function invitationMailText({
  invitation,
  credential,
}: {
  invitation: string;
  credential: string;
}): string {
  return `You have been invited to Commons.\n\nRegister: ${invitationLink(invitation)}\nTemporary password: ${credential}\n\nThis invitation does not expire.`;
}

export function invitationMailHtml({
  invitation,
  credential,
}: {
  invitation: string;
  credential: string;
}): string {
  const link = invitationLink(invitation);
  return `<p>You have been invited to Commons.</p><p><a href="${escapeHtml(link)}">Register your account</a></p><p>Temporary password: <strong>${escapeHtml(credential)}</strong></p><p>This invitation does not expire.</p>`;
}

export function notificationMailText(_input: { notification: string }): string {
  return `You have a new Commons notification. Sign in to view it.\n\n${configuredPublicOrigin()}/notifications`;
}

export function notificationMailHtml(_input: { notification: string }): string {
  const link = `${configuredPublicOrigin()}/notifications`;
  return `<p>You have a new Commons notification. Sign in to view it.</p><p><a href="${escapeHtml(link)}">View notifications</a></p>`;
}
