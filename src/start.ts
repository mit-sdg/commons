import { runCommonsProcess } from "./assembly/process.ts";
import { configuredMongodbUrl, validateDeploymentConfiguration } from "./deployment.ts";
import { mailConfigurationFromEnv } from "./email/configuration.ts";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const host = process.env.HOST ?? "127.0.0.1";
const sourcePort = process.env.PORT ?? "4000";
const port = Number(sourcePort);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: PORT must be an integer from 1 to 65535; received "${sourcePort}"`);
  }
  validateDeploymentConfiguration();
  const mongodbUrl = configuredMongodbUrl();
  const mail = mailConfigurationFromEnv();
  const running = await runCommonsProcess({
    host,
    port,
    ...(mongodbUrl === undefined ? {} : { mongodbUrl }),
    ...(mail === undefined ? {} : { mail }),
    ...(process.env.COMMONS_TEST_BOOTSTRAP === undefined
      ? {}
      : { bootstrap: JSON.parse(process.env.COMMONS_TEST_BOOTSTRAP) }),
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await running.stop();
    } catch {
      console.error("commons: shutdown failed.");
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
} catch (error) {
  console.error(messageOf(error));
  process.exitCode = 1;
}
