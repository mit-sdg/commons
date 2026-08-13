export interface MailConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from: string;
}

export function mailConfigurationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): MailConfiguration | undefined {
  const host = env.SMTP_HOST;
  const from = env.SMTP_FROM;
  if (host === undefined && from === undefined) return undefined;
  if (host === undefined || from === undefined) {
    throw new Error("email: SMTP_HOST and SMTP_FROM must be configured together.");
  }
  const sourcePort = env.SMTP_PORT ?? "587";
  const port = Number(sourcePort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(
      `email: SMTP_PORT must be an integer from 1 to 65535; received "${sourcePort}"`,
    );
  }
  const user = env.SMTP_USERNAME;
  const password = env.SMTP_PASSWORD;
  if ((user === undefined) !== (password === undefined)) {
    throw new Error("email: SMTP_USERNAME and SMTP_PASSWORD must be configured together.");
  }
  return {
    host,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    ...(user === undefined ? {} : { user, password }),
    from,
  };
}
