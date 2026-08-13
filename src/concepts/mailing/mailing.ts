import { MailNotFound } from "./errors.ts";
import { normalizeMailRecipient } from "./recipient.ts";

interface MailDoc {
  key: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
  createdAt: Date;
  sentAt: Date | null;
}

export class MailingConcept {
  private readonly messages = new Map<string, MailDoc>();

  normalizeRecipient({ recipient }: { recipient: string }) {
    return { recipient: normalizeMailRecipient(recipient) };
  }

  enqueue({
    key,
    recipient,
    subject,
    text,
    html,
    at,
  }: {
    key: string;
    recipient: string;
    subject: string;
    text: string;
    html: string;
    at: Date;
  }) {
    const normalizedRecipient = normalizeMailRecipient(recipient);
    for (const [message, doc] of this.messages) {
      if (doc.key !== key) continue;
      Object.assign(doc, {
        recipient: normalizedRecipient,
        subject,
        text,
        html,
        createdAt: at,
        sentAt: null,
      });
      return { message };
    }
    const message = crypto.randomUUID();
    this.messages.set(message, {
      key,
      recipient: normalizedRecipient,
      subject,
      text,
      html,
      createdAt: at,
      sentAt: null,
    });
    return { message };
  }

  markSent({ message, at }: { message: string; at: Date }) {
    const doc = this.messages.get(message);
    if (doc === undefined) throw new MailNotFound(message);
    doc.sentAt = at;
    return { message };
  }

  _getPending(_: Record<string, never>) {
    return [...this.messages]
      .filter(([, doc]) => doc.sentAt === null)
      .map(([message, doc]) => ({
        message,
        key: doc.key,
        recipient: doc.recipient,
        subject: doc.subject,
        text: doc.text,
        html: doc.html,
        createdAt: doc.createdAt,
      }));
  }

  _getStatus({ message }: { message: string }): { sentAt: Date | null }[] {
    const doc = this.messages.get(message);
    return doc === undefined ? [] : [{ sentAt: doc.sentAt }];
  }
}
