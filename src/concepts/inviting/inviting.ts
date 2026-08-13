import { invitationCredential } from "./credential.ts";
import { InvitationAlreadyClaimed, InvitationInvalid } from "./errors.ts";

interface InvitationDoc {
  channel: string;
  address: string;
  createdAt: Date;
  lastInvitedAt: Date;
  inviteCount: number;
  user: string | null;
}

export class InvitingConcept {
  private readonly invitations = new Map<string, InvitationDoc>();

  invite({ channel, address, at }: { channel: string; address: string; at: Date }) {
    for (const [invitation, doc] of this.invitations) {
      if (doc.channel !== channel || doc.address !== address) continue;
      if (doc.user !== null) throw new InvitationAlreadyClaimed(invitation);
      doc.lastInvitedAt = at;
      doc.inviteCount += 1;
      return {
        invitation,
        channel: doc.channel,
        address: doc.address,
        credential: invitationCredential(invitation),
        created: false,
      };
    }

    const invitation = crypto.randomUUID();
    this.invitations.set(invitation, {
      channel,
      address,
      createdAt: at,
      lastInvitedAt: at,
      inviteCount: 1,
      user: null,
    });
    return {
      invitation,
      channel,
      address,
      credential: invitationCredential(invitation),
      created: true,
    };
  }

  verify({
    invitation,
    credential,
    channel,
  }: {
    invitation: string;
    credential: string;
    channel: string;
  }) {
    const doc = this.invitations.get(invitation);
    if (
      doc === undefined ||
      doc.user !== null ||
      doc.channel !== channel ||
      invitationCredential(invitation) !== credential
    ) {
      throw new InvitationInvalid(invitation);
    }
    return { invitation, address: doc.address };
  }

  claim({
    invitation,
    credential,
    user,
  }: {
    invitation: string;
    credential: string;
    user: string;
  }) {
    const doc = this.invitations.get(invitation);
    if (doc === undefined || doc.user !== null || invitationCredential(invitation) !== credential) {
      throw new InvitationInvalid(invitation);
    }
    doc.user = user;
    return { invitation, channel: doc.channel, address: doc.address };
  }

  _getAvailable({
    invitation,
    credential,
  }: {
    invitation: string;
    credential: string;
  }): { channel: string; address: string }[] {
    const doc = this.invitations.get(invitation);
    return doc !== undefined && doc.user === null && invitationCredential(invitation) === credential
      ? [{ channel: doc.channel, address: doc.address }]
      : [];
  }

  _getInvitations(_: Record<string, never>) {
    return [...this.invitations].map(([invitation, doc]) => ({
      invitation,
      channel: doc.channel,
      address: doc.address,
      createdAt: doc.createdAt,
      lastInvitedAt: doc.lastInvitedAt,
      inviteCount: doc.inviteCount,
      user: doc.user,
    }));
  }
}
