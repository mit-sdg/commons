import { configuredAdminSetupSecretVerifier } from "../deployment.ts";
import { passwordMatchesVerifier } from "../concepts/authenticating/password-verifier.ts";

export async function setupSecretMatches({ secret }: { secret: string }): Promise<boolean> {
  return passwordMatchesVerifier(secret, configuredAdminSetupSecretVerifier());
}
