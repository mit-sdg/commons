import { wireScenario } from "../support/wire.ts";

wireScenario("live quiz loop", new URL("./fixtures/live-quizzes.json", import.meta.url));
