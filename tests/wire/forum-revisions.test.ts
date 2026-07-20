import { wireScenario } from "../support/wire.ts";

wireScenario(
  "forum revisions boundary",
  new URL("./fixtures/revisions-posts.json", import.meta.url),
);
