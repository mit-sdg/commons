import { isPasswordVerifier } from "./concepts/authenticating/password-verifier.ts";

export function configuredPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production" && env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  return (env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

export function configuredMongodbUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const uri = env.MONGODB_URI === "" ? undefined : env.MONGODB_URI;
  const url = env.MONGODB_URL === "" ? undefined : env.MONGODB_URL;
  if (uri !== undefined && url !== undefined && uri !== url) {
    throw new Error("commons: MONGODB_URI and MONGODB_URL must not conflict.");
  }
  return uri ?? url;
}

export function configuredAdminSetupSecretVerifier(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const verifier = env.ADMIN_SETUP_SECRET_HASH;
  if (verifier === undefined || verifier === "") return undefined;
  if (!isPasswordVerifier(verifier)) {
    throw new Error("commons: ADMIN_SETUP_SECRET_HASH is not a valid setup-secret hash.");
  }
  return verifier;
}

export function validateDeploymentConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  configuredAdminSetupSecretVerifier(env);
  const mongodbUrl = configuredMongodbUrl(env);
  if (env.NODE_ENV !== "production") return;
  if (env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  if (env.INVITATION_SECRET === undefined) {
    throw new Error("commons: INVITATION_SECRET is required in production.");
  }
  if (mongodbUrl === undefined) {
    throw new Error("commons: MONGODB_URI or MONGODB_URL is required in production.");
  }
}
