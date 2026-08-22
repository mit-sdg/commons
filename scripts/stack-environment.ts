type ProcessEnvironment = Record<string, string | undefined>;

export function stackBackendEnvironment(
  inherited: ProcessEnvironment,
  webOrigin: string,
): ProcessEnvironment {
  return {
    ...inherited,
    PUBLIC_ORIGIN: inherited.PUBLIC_ORIGIN ?? webOrigin,
  };
}
