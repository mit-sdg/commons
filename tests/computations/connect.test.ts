import { describe, expect, test } from "vite-plus/test";
import {
  connectAppHost,
  connectCallback,
  connectCode,
  connectCodeCredential,
  connectCodeExpiry,
  connectCodeVoucher,
  connectDisplayName,
  isConnectApp,
} from "../../src/computations/connect.ts";
import { voucherCredential } from "../../src/concepts/vouching/credential.ts";

const DOMAIN = "mit-sdg.dev";
const COMMONS = "https://class.mit-sdg.dev";

describe("which origins are apps Commons signs people in to", () => {
  test("the configured domain itself and every name one label below it, over https", () => {
    for (const app of [
      "https://mit-sdg.dev",
      "https://team-7.mit-sdg.dev",
      "https://a.mit-sdg.dev",
      `https://${"a".repeat(63)}.mit-sdg.dev`,
      "https://xn--bcher-kva.mit-sdg.dev",
    ]) {
      expect(isConnectApp(app, DOMAIN, COMMONS), app).toBe(true);
    }
  });

  test("an app on this machine at an explicit port, configured domain or not", () => {
    for (const domain of [DOMAIN, undefined]) {
      for (const app of [
        "http://localhost:1",
        "http://localhost:4311",
        "http://localhost:65535",
        "http://127.0.0.1:3000",
      ]) {
        expect(isConnectApp(app, domain, COMMONS), `${app} ${domain}`).toBe(true);
      }
    }
  });

  test("nothing over https without a configured domain", () => {
    expect(isConnectApp("https://mit-sdg.dev", undefined, COMMONS)).toBe(false);
    expect(isConnectApp("https://team-7.mit-sdg.dev", undefined, COMMONS)).toBe(false);
  });

  test("never Commons' own origin, however it is configured", () => {
    expect(isConnectApp(COMMONS, DOMAIN, COMMONS)).toBe(false);
    expect(isConnectApp(COMMONS, DOMAIN, "https://CLASS.mit-sdg.dev")).toBe(false);
    expect(isConnectApp("https://mit-sdg.dev", DOMAIN, "https://mit-sdg.dev")).toBe(false);
    expect(isConnectApp("http://127.0.0.1:3000", DOMAIN, "http://127.0.0.1:3000")).toBe(false);
    expect(isConnectApp("http://localhost:3000", DOMAIN, "http://127.0.0.1:3000")).toBe(true);
  });

  test("an origin written any other way, or with anything after it, is refused", () => {
    for (const app of [
      "",
      "mit-sdg.dev",
      "https://",
      "https://a.b.mit-sdg.dev",
      "https://Team-7.mit-sdg.dev",
      "HTTPS://team-7.mit-sdg.dev",
      "https://team-7.MIT-SDG.dev",
      "https://team-7.mit-sdg.dev/",
      "https://team-7.mit-sdg.dev/auth/commons/callback",
      "https://team-7.mit-sdg.dev?x=1",
      "https://team-7.mit-sdg.dev#x",
      "https://user@team-7.mit-sdg.dev",
      "https://user:pass@mit-sdg.dev",
      "https://team-7.mit-sdg.dev:443",
      "https://team-7.mit-sdg.dev.",
      "https://-team.mit-sdg.dev",
      "https://team-.mit-sdg.dev",
      "https://team_7.mit-sdg.dev",
      `https://${"a".repeat(64)}.mit-sdg.dev`,
      "https://.mit-sdg.dev",
      "https://evilmit-sdg.dev",
      "https://mit-sdg.dev.evil.example",
      "https://evil.example/.mit-sdg.dev",
      "http://mit-sdg.dev",
      "http://team-7.mit-sdg.dev",
      "wss://team-7.mit-sdg.dev",
      "https://evil.example",
      "http://localhost",
      "http://localhost:",
      "http://localhost:0",
      "http://localhost:01",
      "http://localhost:65536",
      "http://localhost:99999",
      "http://localhost:3000/",
      "http://LOCALHOST:3000",
      "https://localhost:3000",
      "http://127.0.0.2:3000",
      "http://[::1]:3000",
      "http://localhost.mit-sdg.dev:3000",
      " https://mit-sdg.dev",
      "https://mit-sdg.dev ",
      "https://mit-sdg.dev\n",
    ]) {
      expect(isConnectApp(app, DOMAIN, COMMONS), JSON.stringify(app)).toBe(false);
    }
    for (const app of [undefined, null, 3, ["https://mit-sdg.dev"], {}]) {
      expect(isConnectApp(app, DOMAIN, COMMONS)).toBe(false);
    }
  });

  test("an accepted app is shown by its host and receives its code at one fixed callback", () => {
    expect(connectAppHost({ app: "https://team-7.mit-sdg.dev" })).toBe("team-7.mit-sdg.dev");
    expect(connectAppHost({ app: "http://localhost:4311" })).toBe("localhost:4311");
    expect(connectCallback({ app: "https://mit-sdg.dev" })).toBe(
      "https://mit-sdg.dev/auth/commons/callback",
    );
  });
});

describe("sign-in codes", () => {
  test("lapse sixty seconds after approval", () => {
    expect(connectCodeExpiry({ at: new Date("2026-10-05T12:00:00Z") })).toEqual(
      new Date("2026-10-05T12:01:00Z"),
    );
  });

  test("carry a voucher and its credential, and read back to both", () => {
    const voucher = crypto.randomUUID();
    const credential = voucherCredential(voucher);
    const code = connectCode({ voucher, credential });
    expect(code).toBe(`${voucher}.${credential}`);
    expect(code.length).toBeLessThanOrEqual(128);
    expect(code).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(connectCodeVoucher({ code })).toBe(voucher);
    expect(connectCodeCredential({ code })).toBe(credential);
  });

  test("read text that is not a code as an empty voucher and credential", () => {
    for (const code of [
      "",
      ".",
      "voucher",
      "voucher.",
      ".credential",
      "a.b.c",
      "a b.c",
      "a.b\n",
      `${"a".repeat(65)}.b`,
      `a.${"b".repeat(64)}`,
    ]) {
      expect(connectCodeVoucher({ code }), JSON.stringify(code)).toBe("");
      expect(connectCodeCredential({ code }), JSON.stringify(code)).toBe("");
    }
  });
});

describe("the name an app is given", () => {
  test("is the profile's display name, or the username when it has none", () => {
    expect(connectDisplayName({ username: "ines", displayName: "Ines Duarte" })).toBe(
      "Ines Duarte",
    );
    expect(connectDisplayName({ username: "ines", displayName: "  Ines  " })).toBe("Ines");
    for (const displayName of [undefined, null, "", "   "]) {
      expect(connectDisplayName({ username: "ines", displayName })).toBe("ines");
    }
  });

  test("is at most 256 characters and never ends inside a character", () => {
    expect(connectDisplayName({ username: "ines", displayName: "a".repeat(300) })).toBe(
      "a".repeat(256),
    );
    const astral = `${"a".repeat(255)}😀tail`;
    expect(connectDisplayName({ username: "ines", displayName: astral })).toBe("a".repeat(255));
  });
});
