import { wireScenario } from "../support/wire.ts";

wireScenario(
  "assignments and submissions boundary",
  new URL("./fixtures/assignments-submissions.json", import.meta.url),
);
