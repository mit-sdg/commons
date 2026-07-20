import { wireScenario } from "../support/wire.ts";

wireScenario(
  "access and roster boundary",
  new URL("./fixtures/roster-access.json", import.meta.url),
);
