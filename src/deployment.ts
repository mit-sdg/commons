export function configuredPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production" && env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  return (env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function validateDeploymentConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  if (env.INVITATION_SECRET === undefined) {
    throw new Error("commons: INVITATION_SECRET is required in production.");
  }
}
