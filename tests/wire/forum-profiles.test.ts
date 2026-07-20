import { wireScenario } from "../support/wire.ts";

wireScenario(
  "forum profiles boundary",
  new URL("./fixtures/profiles-userpages.json", import.meta.url),
);
