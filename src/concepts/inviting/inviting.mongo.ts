import type { Collection, Db } from "mongodb";
import { invitationCredential } from "./credential.ts";
import { InvitationAlreadyClaimed, InvitationInvalid, InvitationNotFound } from "./errors.ts";

interface InvitationDoc {
  _id: string;
  channel: string;
  address: string;
  createdAt: Date;
  lastInvitedAt: Date;
  inviteCount: number;
  user: string | null;
}

export class MongoInvitingConcept {
  private readonly invitations: Collection<InvitationDoc>;
  private index: Promise<string> | undefined;

  constructor(db: Db) {
    this.invitations = db.collection<InvitationDoc>("inviting.invitations");
  }

  async invite({ channel, address, at }: { channel: string; address: string; at: Date }) {
    await (this.index ??= this.invitations.createIndex(
      { channel: 1, address: 1 },
      { unique: true },
    ));
    const resend = async (existing: InvitationDoc) => {
      if (existing.user !== null) throw new InvitationAlreadyClaimed(existing._id);
      const updated = await this.invitations.updateOne(
        { _id: existing._id, user: null },
        { $set: { lastInvitedAt: at }, $inc: { inviteCount: 1 } },
      );
      if (updated.matchedCount === 0) throw new InvitationAlreadyClaimed(existing._id);
      return {
        invitation: existing._id,
        channel: existing.channel,
        address: existing.address,
        credential: invitationCredential(existing._id),
        created: false,
      };
    };

    const existing = await this.invitations.findOne({ channel, address });
    if (existing !== null) return resend(existing);

    const invitation = crypto.randomUUID();
    try {
      await this.invitations.insertOne({
        _id: invitation,
        channel,
        address,
        createdAt: at,
        lastInvitedAt: at,
        inviteCount: 1,
        user: null,
      });
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== 11_000
      ) {
        throw error;
      }
      const raced = await this.invitations.findOne({ channel, address });
      if (raced === null) throw error;
      return resend(raced);
    }
    return {
      invitation,
      channel,
      address,
      credential: invitationCredential(invitation),
      created: true,
    };
  }

  async verify({
    invitation,
    credential,
    channel,
  }: {
    invitation: string;
    credential: string;
    channel: string;
  }) {
    if (invitationCredential(invitation) !== credential) {
      throw new InvitationInvalid(invitation);
    }
    const doc = await this.invitations.findOne({ _id: invitation, channel, user: null });
    if (doc === null) throw new InvitationInvalid(invitation);
    return { invitation, address: doc.address };
  }

  async claim({
    invitation,
    credential,
    user,
  }: {
    invitation: string;
    credential: string;
    user: string;
  }) {
    if (invitationCredential(invitation) !== credential) {
      throw new InvitationInvalid(invitation);
    }
    const result = await this.invitations.findOneAndUpdate(
      { _id: invitation, user: null },
      { $set: { user } },
      { returnDocument: "after" },
    );
    if (result === null) throw new InvitationInvalid(invitation);
    return {
      invitation,
      channel: result.channel,
      address: result.address,
    };
  }

  async retract({ invitation }: { invitation: string }) {
    const result = await this.invitations.findOneAndDelete({ _id: invitation, user: null });
    if (result !== null) {
      return {};
    }
    const existing = await this.invitations.findOne({ _id: invitation });
    if (existing !== null && existing.user !== null) {
      throw new InvitationAlreadyClaimed(invitation);
    }
    throw new InvitationNotFound(invitation);
  }

  async _getAvailable({ invitation, credential }: { invitation: string; credential: string }) {
    if (invitationCredential(invitation) !== credential) return [];
    const doc = await this.invitations.findOne({ _id: invitation, user: null });
    return doc === null ? [] : [{ channel: doc.channel, address: doc.address }];
  }

  async _getInvitationByAddress({ channel, address }: { channel: string; address: string }) {
    const doc = await this.invitations.findOne({ channel, address });
    return doc === null ? [] : [{ invitation: doc._id, user: doc.user }];
  }

  async _getInvitations(_: Record<string, never>) {
    return (await this.invitations.find().sort({ createdAt: -1 }).toArray()).map((doc) => ({
      invitation: doc._id,
      channel: doc.channel,
      address: doc.address,
      createdAt: doc.createdAt,
      lastInvitedAt: doc.lastInvitedAt,
      inviteCount: doc.inviteCount,
      user: doc.user,
    }));
  }
}
