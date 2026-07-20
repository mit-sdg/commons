import { wireScenario } from "../support/wire.ts";

wireScenario(
  "notes and calendar boundary",
  new URL("./fixtures/notes-calendar.json", import.meta.url),
);
