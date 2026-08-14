import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";

const parameters = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;
const scrypt = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    derive(password, salt, length, parameters, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
const dummyVerifier =
  "$scrypt$N=16384,r=8,p=1$bGVhcm5pbmctZHVtbXktc2FsdA==$rqmuijqwa+A/i5ql2G3alYMtp2zIn/vCgvHuk+cRWFo=";

export async function derivePasswordVerifier(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return `$scrypt$N=16384,r=8,p=1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function isPasswordVerifier(value: string): boolean {
  const [, algorithm, encodedParameters, saltText, keyText, extra] = value.split("$");
  if (
    algorithm !== "scrypt" ||
    encodedParameters !== "N=16384,r=8,p=1" ||
    saltText === undefined ||
    keyText === undefined ||
    extra !== undefined
  ) {
    return false;
  }
  return (
    Buffer.from(saltText, "base64").length === 16 && Buffer.from(keyText, "base64").length === 32
  );
}

export async function passwordMatchesVerifier(
  password: string,
  verifier: string | undefined,
): Promise<boolean> {
  const candidate =
    verifier !== undefined && isPasswordVerifier(verifier) ? verifier : dummyVerifier;
  const [, , , saltText, keyText] = candidate.split("$");
  const expected = Buffer.from(keyText, "base64");
  const actual = await scrypt(password, Buffer.from(saltText, "base64"), expected.length);
  return (
    verifier !== undefined &&
    candidate === verifier &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
