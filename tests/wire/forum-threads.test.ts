import { wireScenario } from "../support/wire.ts";

wireScenario("forum threads boundary", new URL("./fixtures/threads.json", import.meta.url));
