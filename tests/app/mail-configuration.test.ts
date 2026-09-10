import nodemailer from "nodemailer";
import { describe, expect, test, vi } from "vite-plus/test";
import { mailConfigurationFromEnv } from "../../src/email/configuration.ts";
import { deliverPendingMail, smtpSender, type MailSender } from "../../src/email/worker.ts";

const env = {
  SMTP_HOST: "smtp.example.edu",
  SMTP_USERNAME: "personal-login",
  SMTP_PASSWORD: "smtp-secret",
  SMTP_FROM: "Course Team <course@example.edu>",
  SMTP_REPLY_TO: " Teaching Staff <help@example.edu> ",
};

describe("SMTP identity", () => {
  test("from and reply-to are independent of transport authentication", async () => {
    const config = mailConfigurationFromEnv(env)!;
    expect(config).toMatchObject({
      user: "personal-login",
      password: "smtp-secret",
      from: env.SMTP_FROM,
      replyTo: env.SMTP_REPLY_TO.trim(),
    });
    const transportSpy = vi.spyOn(nodemailer, "createTransport");
    try {
      smtpSender(config);
      expect(transportSpy).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: "personal-login", pass: "smtp-secret" } }),
      );
    } finally {
      transportSpy.mockRestore();
    }
    const sent: Parameters<MailSender["sendMail"]>[0][] = [];
    const outbox = {
      _getPending: async () => [
        {
          message: "mail-1",
          generation: "generation-1",
          key: "invite-1",
          recipient: "student@example.edu",
          subject: "Invitation",
          text: "Welcome",
          html: "<p>Welcome</p>",
        },
      ],
      markSent: vi.fn(),
      markFailed: vi.fn(),
    };
    expect(
      await deliverPendingMail(outbox, config, {
        async sendMail(message) {
          sent.push(message);
        },
      }),
    ).toBe(1);
    expect(sent[0]).toMatchObject({
      from: env.SMTP_FROM,
      replyTo: env.SMTP_REPLY_TO.trim(),
      to: "student@example.edu",
    });
    expect(sent[0]).not.toHaveProperty("password");
    expect(sent[0]).not.toHaveProperty("user");
  });

  test("reply-to is optional and blank configuration is omitted", async () => {
    const config = mailConfigurationFromEnv({ ...env, SMTP_REPLY_TO: " " })!;
    expect(config).not.toHaveProperty("replyTo");
    const sendMail = vi.fn(async (_message: Parameters<MailSender["sendMail"]>[0]) => {});
    await deliverPendingMail(
      {
        _getPending: () => [
          {
            message: "mail",
            generation: null,
            key: "invite",
            recipient: "a@b.edu",
            subject: "Welcome",
            text: "Body",
            html: "<p>Body</p>",
          },
        ],
        markSent: () => {},
        markFailed: () => {},
      },
      config,
      { sendMail },
    );
    expect(sendMail.mock.calls[0][0]).not.toHaveProperty("replyTo");
    expect(mailConfigurationFromEnv({})).toBeUndefined();
  });

  test("rejects multiline reply-to and retains existing configuration validation", () => {
    expect(() =>
      mailConfigurationFromEnv({
        ...env,
        SMTP_REPLY_TO: "valid@example.edu\r\nBcc: hidden@example.edu",
      }),
    ).toThrow("single-line");
    expect(() => mailConfigurationFromEnv({ SMTP_HOST: env.SMTP_HOST })).toThrow(
      "configured together",
    );
    expect(() => mailConfigurationFromEnv({ ...env, SMTP_PASSWORD: "" })).toThrow(
      "configured together",
    );
    expect(() => mailConfigurationFromEnv({ ...env, SMTP_PORT: "NaN" })).toThrow("SMTP_PORT");
  });
});
