import { wireScenario } from "../support/wire.ts";

wireScenario(
  "forum notifications boundary",
  new URL("./fixtures/notifications-mentions.json", import.meta.url),
);
