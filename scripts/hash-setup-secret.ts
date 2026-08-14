import { derivePasswordVerifier } from "../src/concepts/authenticating/password-verifier.ts";

if (process.stdin.isTTY) {
  console.error("commons: pipe a 32-character-or-longer setup secret to this command");
  process.exit(1);
}

const secret = (await Bun.stdin.text()).replace(/[\r\n]+$/, "");
if (secret.length < 32) {
  console.error("commons: the setup secret must contain at least 32 characters");
  process.exit(1);
}

console.log(await derivePasswordVerifier(secret));
