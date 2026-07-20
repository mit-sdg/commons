import { wireScenario } from "../support/wire.ts";

wireScenario(
  "forum links, pins, unread, and account boundary",
  new URL("./fixtures/forum-links-pins-unread-account.json", import.meta.url),
);
