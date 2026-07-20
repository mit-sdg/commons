import { wireScenario } from "../support/wire.ts";

wireScenario("forum feed boundary", new URL("./fixtures/feed-satellites.json", import.meta.url));
