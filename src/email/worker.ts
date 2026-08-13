import nodemailer from "nodemailer";
import type { MailConfiguration } from "./configuration.ts";

export interface MailSender {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    messageId: string;
  }): Promise<unknown>;
}

interface PendingMail {
  message: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
}

type Awaitable<Value> = Value | PromiseLike<Value>;

export interface MailOutbox {
  _getPending(input: Record<string, never>): Awaitable<PendingMail[]>;
  markSent(input: { message: string; at: Date }): Awaitable<unknown>;
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
): Promise<number> {
  const pending = await outbox._getPending({});
  let delivered = 0;
  for (const mail of pending) {
    try {
      await sender.sendMail({
        from: configuration.from,
        to: mail.recipient,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        messageId: `<${mail.message}@${configuration.host}>`,
      });
      await outbox.markSent({ message: mail.message, at: new Date() });
      delivered += 1;
    } catch {
      console.error("email: delivery failed; the message remains queued.");
    }
  }
  return delivered;
}

export function startMailWorker(
  outbox: MailOutbox,
  configuration: MailConfiguration,
  sender: MailSender = smtpSender(configuration),
  intervalMs = 2_000,
) {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running !== undefined) return;
    running = deliverPendingMail(outbox, configuration, sender)
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
