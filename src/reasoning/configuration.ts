export interface ReasonerConfiguration {
  mode: "gemini" | "scripted";
  apiKey: string;
  model: string;
}

const configured = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value;

/**
 * The reasoner floor is configured by environment. `REASONER` may name Gemini
 * or the deterministic scripted mind used by tests and local demos; production
 * never admits the scripted mode. A `GEMINI_API_KEY` enables Gemini over the
 * optional `GEMINI_MODEL`. Without a key or scripted mode, reasoning is disabled.
 */
export function reasonerConfigurationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReasonerConfiguration | undefined {
  const mode = env.REASONER?.trim() || undefined;
  if (mode !== undefined && mode !== "gemini" && mode !== "scripted") {
    throw new Error('reasoner: REASONER must be "gemini" or "scripted".');
  }
  if (mode === "scripted" && env.NODE_ENV === "production") {
    throw new Error("reasoner: REASONER=scripted is not allowed in production.");
  }
  if (mode === "scripted") {
    return { mode: "scripted", apiKey: "", model: "scripted" };
  }
  const apiKey = configured(env.GEMINI_API_KEY);
  if (apiKey === undefined) return undefined;
  return { mode: "gemini", apiKey, model: configured(env.GEMINI_MODEL) ?? "gemini-3.7-flash" };
}
