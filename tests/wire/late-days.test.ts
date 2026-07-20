import { wireScenario } from "../support/wire.ts";

wireScenario("late-days boundary", new URL("./fixtures/late-days.json", import.meta.url));
