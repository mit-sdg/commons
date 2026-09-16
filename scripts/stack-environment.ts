type ProcessEnvironment = Record<string, string | undefined>;

/** CI serves the built route manifest rather than relying on development route discovery. */
export function stackFrontendProcess({
  root,
  edgeOrigin,
  webHost,
  webPort,
  inherited,
}: {
  root: string;
  edgeOrigin: string;
  webHost: string;
  webPort: string;
  inherited: ProcessEnvironment;
}) {
  const standalone = inherited.COMMONS_E2E_STANDALONE === "1";
  const env = { ...inherited };
  delete env.PORT;
  return {
    command: standalone
      ? ["node", ".next/standalone/frontend/server.js"]
      : ["bun", "run", "dev", "--", "--hostname", webHost, "--port", webPort],
    cwd: `${root}/frontend`,
    env: {
      ...env,
      BACKEND_ORIGIN: edgeOrigin,
      PATH: `${root}/frontend/node_modules/.bin:${inherited.PATH ?? ""}`,
      ...(standalone
        ? { NODE_ENV: "production", HOSTNAME: webHost, PORT: webPort }
        : { WATCHPACK_POLLING: "true" }),
    },
  };
}

export function stackBackendEnvironment(
  inherited: ProcessEnvironment,
  webOrigin: string,
): ProcessEnvironment {
  return {
    ...inherited,
    PUBLIC_ORIGIN: inherited.PUBLIC_ORIGIN ?? webOrigin,
  };
}
