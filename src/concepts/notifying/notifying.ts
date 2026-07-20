import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { NotificationNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface NotificationDoc {
  recipient: string;
  kind: string;
  subject: string;
  link: string | null;
  createdAt: Date;
  read: boolean;
}

export class NotifyingConcept {
  static readonly queries = {
    _getInbox: "many",
    _hasFor: "one",
    _getUnreadCount: "one",
  } as const satisfies Record<string, QueryPromise>;

  private readonly notifications = new Map<string, NotificationDoc>();

  notify({
    recipient,
    kind,
    subject,
    link,
    at,
  }: {
    recipient: string;
    kind: string;
    subject: string;
    link: string | null;
    at: Date;
  }) {
    const notification = freshID();
    this.notifications.set(notification, {
      recipient,
      kind,
      subject,
      link,
      createdAt: at,
      read: false,
    });
    return { notification };
  }

  #ownedOrRefuse(notification: string, recipient: string): NotificationDoc {
    const doc = this.notifications.get(notification);
    if (doc === undefined || doc.recipient !== recipient) {
      throw new NotificationNotFound(notification);
    }
    return doc;
  }

  markRead({ notification, recipient }: { notification: string; recipient: string }) {
    const doc = this.#ownedOrRefuse(notification, recipient);
    doc.read = true;
    return { notification };
  }

  markAllRead({ recipient }: { recipient: string }) {
    for (const doc of this.notifications.values()) {
      if (doc.recipient === recipient) doc.read = true;
    }
    return { recipient };
  }

  dismiss({ notification, recipient }: { notification: string; recipient: string }) {
    this.#ownedOrRefuse(notification, recipient);
    this.notifications.delete(notification);
    return { notification };
  }

  clearSubject({ subject }: { subject: string }) {
    for (const [notification, doc] of this.notifications)
      if (doc.subject === subject) this.notifications.delete(notification);
    return { subject };
  }

  _getInbox({ recipient }: { recipient: string }): {
    notification: string;
    kind: string;
    subject: string;
    link: string | null;
    createdAt: Date;
    read: boolean;
  }[] {
    const rows: [string, NotificationDoc][] = [];
    let position = 0;
    const arrival = new Map<string, number>();
    for (const [notification, doc] of this.notifications) {
      arrival.set(notification, (position += 1));
      if (doc.recipient === recipient) rows.push([notification, doc]);
    }
    return rows
      .sort(
        ([aId, a], [bId, b]) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (arrival.get(bId) ?? 0) - (arrival.get(aId) ?? 0),
      )
      .map(([notification, doc]) => ({
        notification,
        kind: doc.kind,
        subject: doc.subject,
        link: doc.link,
        createdAt: doc.createdAt,
        read: doc.read,
      }));
  }

  _hasFor({ user, subject }: { user: string; subject: string }): { notified: boolean } {
    for (const doc of this.notifications.values()) {
      if (doc.recipient === user && doc.subject === subject) return { notified: true };
    }
    return { notified: false };
  }

  _getUnreadCount({ recipient }: { recipient: string }): { count: number } {
    let count = 0;
    for (const doc of this.notifications.values()) {
      if (doc.recipient === recipient && !doc.read) count += 1;
    }
    return { count };
  }
}
