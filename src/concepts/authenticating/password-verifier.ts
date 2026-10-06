import { randomBytes, scrypt as derive, timingSafeEqual } from "node:crypto";

const parameters = { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 } as const;
let workFactor: number = parameters.N;

/**
 * Test fixtures may use a cheaper KDF; production always starts at N=16384.
 * Only the Vitest runtime may lower it, so a stray production call cannot
 * start minting or accepting weak verifiers.
 */
export function setPasswordWorkFactorForTests(N: 16 | 16_384): () => void {
  if (process.env.VITEST === undefined)
    throw new Error("commons: the password work factor can only change under Vitest.");
  const previous = workFactor;
  workFactor = N;
  return () => {
    workFactor = previous;
  };
}

const encodedParameters = (N: number) => `N=${N},r=8,p=1`;
const scrypt = (password: string, salt: Buffer, length: number, N: number) =>
  new Promise<Buffer>((resolve, reject) =>
    derive(password, salt, length, { ...parameters, N }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
const dummyVerifier = (N: number) =>
  `$scrypt$${encodedParameters(N)}$bGVhcm5pbmctZHVtbXktc2FsdA==$rqmuijqwa+A/i5ql2G3alYMtp2zIn/vCgvHuk+cRWFo=`;

export async function derivePasswordVerifier(password: string): Promise<string> {
  const salt = randomBytes(16);
  const N = workFactor;
  const key = await scrypt(password, salt, 32, N);
  return `$scrypt$${encodedParameters(N)}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export function isPasswordVerifier(value: string): boolean {
  const [, algorithm, encodedParameters, saltText, keyText, extra] = value.split("$");
  if (
    algorithm !== "scrypt" ||
    (encodedParameters !== "N=16384,r=8,p=1" && encodedParameters !== `N=${workFactor},r=8,p=1`) ||
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
    verifier !== undefined && isPasswordVerifier(verifier) ? verifier : dummyVerifier(workFactor);
  const [, , , saltText, keyText] = candidate.split("$");
  const expected = Buffer.from(keyText, "base64");
  const N = Number(candidate.split("$")[2].split(",")[0].slice(2));
  const actual = await scrypt(password, Buffer.from(saltText, "base64"), expected.length, N);
  return (
    verifier !== undefined &&
    candidate === verifier &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
