import { expect, test } from "vite-plus/test";
import {
  derivePasswordVerifier,
  isPasswordVerifier,
  passwordMatchesVerifier,
  setPasswordWorkFactorForTests,
} from "../../src/concepts/authenticating/password-verifier.ts";

test("production verifiers retain their work factor while fixtures opt into cheap hashes", async () => {
  const restore = setPasswordWorkFactorForTests(16_384);
  try {
    const production = await derivePasswordVerifier("password123");
    expect(production).toMatch(/^\$scrypt\$N=16384,r=8,p=1\$/);
    expect(await passwordMatchesVerifier("password123", production)).toBe(true);
    expect(await passwordMatchesVerifier("wrong-password", production)).toBe(false);
    const restoreProduction = setPasswordWorkFactorForTests(16);
    let fixture: string;
    try {
      fixture = await derivePasswordVerifier("password123");
      expect(fixture).toMatch(/^\$scrypt\$N=16,r=8,p=1\$/);
      expect(await passwordMatchesVerifier("password123", fixture)).toBe(true);
      // Existing production accounts still use their encoded cost.
      expect(await passwordMatchesVerifier("password123", production)).toBe(true);
      expect(await passwordMatchesVerifier("password123", undefined)).toBe(false);
    } finally {
      restoreProduction();
    }
    expect(isPasswordVerifier(fixture)).toBe(false);
    expect(isPasswordVerifier(production)).toBe(true);
  } finally {
    restore();
  }
});
