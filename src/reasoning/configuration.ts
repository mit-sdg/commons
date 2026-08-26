export interface ReasonerConfiguration {
  mode: "gemini" | "scripted";
  apiKey: string;
  model: string;
}

const configured = (value: string | undefined) =>
  value === undefined || value.trim() === "" ? undefined : value;

/**
 * The reasoner floor is configured by environment: `REASONER=scripted` selects
 * the deterministic scripted mind (tests, demos without a key), and otherwise a
 * `GEMINI_API_KEY` selects the Gemini mind over `GEMINI_MODEL`. With neither,
 * reasoning is disabled: asks stay pending and the drafting surface says so.
 */
export function reasonerConfigurationFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReasonerConfiguration | undefined {
  if (configured(env.REASONER) === "scripted") {
    return { mode: "scripted", apiKey: "", model: "scripted" };
  }
  const apiKey = configured(env.GEMINI_API_KEY);
  if (apiKey === undefined) return undefined;
  return { mode: "gemini", apiKey, model: configured(env.GEMINI_MODEL) ?? "gemini-3.7-flash" };
}
