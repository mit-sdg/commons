import { wireScenario } from "../support/wire.ts";

wireScenario(
  "forum bookmarks and reactions boundary",
  new URL("./fixtures/reactions-bookmarks.json", import.meta.url),
);
