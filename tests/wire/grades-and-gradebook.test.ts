import { wireScenario } from "../support/wire.ts";

wireScenario(
  "grades and gradebook boundary",
  new URL("./fixtures/grades-gradebook.json", import.meta.url),
);
