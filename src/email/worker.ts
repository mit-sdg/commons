import nodemailer from "nodemailer";
import type { MailConfiguration } from "./configuration.ts";

export interface MailSender {
  sendMail(message: {
    from: string;
    replyTo?: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    messageId: string;
  }): Promise<unknown>;
}

export interface PendingMail {
  key: string;
  message: string;
  generation: string | null;
  recipient: string;
  subject: string;
  text: string;
  html: string;
}

export type MailEligibility = (mail: PendingMail) => Promise<boolean>;

type Awaitable<Value> = Value | PromiseLike<Value>;

export interface MailOutbox {
  _getPending(input: Record<string, never>): Awaitable<PendingMail[]>;
  markSent(input: { message: string; generation: string | null; at: Date }): Awaitable<unknown>;
  markFailed(input: {
    message: string;
    generation: string | null;
    error: string;
    at: Date;
  }): Awaitable<unknown>;
}

/** Keep the outbox reason short and free of the transport's stack trace. */
function deliveryFailureReason(error: unknown): string {
  const raw =
    error instanceof Error
      ? `${error.message}`
      : typeof error === "string"
        ? error
        : "The mail transport rejected the message.";
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 299)}\u2026` : collapsed;
}

export function smtpSender(configuration: MailConfiguration): MailSender {
  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    requireTLS: !configuration.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    ...(configuration.user === undefined
      ? {}
      : { auth: { user: configuration.user, pass: configuration.password } }),
  });
}

export async function deliverPendingMail(
  outbox: MailOutbox,
  configuration: MailConfiguration,
  sender: MailSender,
  eligible: MailEligibility = async (mail) => !mail.key.startsWith("forum:"),
): Promise<number> {
  const pending = await outbox._getPending({});
  let delivered = 0;
  for (const mail of pending) {
    try {
      if (!(await eligible(mail))) continue;
      await sender.sendMail({
        from: configuration.from,
        ...(configuration.replyTo === undefined ? {} : { replyTo: configuration.replyTo }),
        to: mail.recipient,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        messageId: `<${mail.message}.${mail.generation ?? "legacy"}@${configuration.host}>`,
      });
      await outbox.markSent({ message: mail.message, generation: mail.generation, at: new Date() });
      delivered += 1;
    } catch (error) {
      console.error("email: delivery failed; the message remains queued.");
      try {
        await outbox.markFailed({
          message: mail.message,
          generation: mail.generation,
          error: deliveryFailureReason(error),
          at: new Date(),
        });
      } catch {
        console.error("email: could not record the delivery failure.");
      }
    }
  }
  return delivered;
}

export function startMailWorker(
  outbox: MailOutbox,
  configuration: MailConfiguration,
  sender: MailSender = smtpSender(configuration),
  intervalMs = 2_000,
  eligible?: MailEligibility,
) {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running !== undefined) return;
    running = deliverPendingMail(outbox, configuration, sender, eligible)
      .then(() => undefined)
      .catch(() => console.error("email: could not read the outbox."))
      .finally(() => {
        running = undefined;
      });
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
