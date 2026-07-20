import { wireScenario } from "../support/wire.ts";

wireScenario("forum moderation boundary", new URL("./fixtures/moderation.json", import.meta.url));
