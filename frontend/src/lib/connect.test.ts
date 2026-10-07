import { describe, expect, test } from "bun:test";
import {
  appHost,
  approvedCallback,
  connectRequest,
  deniedCallback,
  isConnectState,
} from "./connect.ts";

const STATE = "Abc123._~-xyz7890";
// RFC 7636, Appendix B.
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("an app's sign-in state", () => {
  test("is 16 to 256 letters, digits, or ._~-", () => {
    expect(isConnectState(STATE)).toBe(true);
    expect(isConnectState("a".repeat(16))).toBe(true);
    expect(isConnectState("a".repeat(256))).toBe(true);
  });

  test("is refused when shorter, longer, or holding anything else", () => {
    for (const state of [
      "",
      "a".repeat(15),
      "a".repeat(257),
      `${"a".repeat(16)} `,
      `${"a".repeat(16)}/`,
      `${"a".repeat(16)}%20`,
      `${"a".repeat(16)}+`,
      `${"a".repeat(16)}=`,
      `${"a".repeat(16)}\n`,
      `${"a".repeat(16)}é`,
    ]) {
      expect(isConnectState(state)).toBe(false);
    }
  });
});

describe("a sign-in request", () => {
  test("names exactly one app and one valid state", () => {
    expect(
      connectRequest(
        new URLSearchParams({ app: "https://mit-sdg.dev", state: STATE }),
      ),
    ).toEqual({ app: "https://mit-sdg.dev", state: STATE, challenge: null });
  });

  test("carries an S256 challenge through", () => {
    expect(
      connectRequest(
        new URLSearchParams({
          app: "https://team-7.mit-sdg.dev",
          state: STATE,
          code_challenge: CHALLENGE,
          code_challenge_method: "S256",
        }),
      ),
    ).toEqual({
      app: "https://team-7.mit-sdg.dev",
      state: STATE,
      challenge: { code_challenge: CHALLENGE, code_challenge_method: "S256" },
    });
  });

  test("is refused when the challenge is malformed, repeated, or not S256", () => {
    const base = `app=https%3A%2F%2Fteam-7.mit-sdg.dev&state=${STATE}`;
    for (const challenge of [
      `code_challenge=${CHALLENGE}`,
      "code_challenge_method=S256",
      `code_challenge=${CHALLENGE}&code_challenge_method=plain`,
      `code_challenge=${CHALLENGE}&code_challenge_method=s256`,
      `code_challenge=${CHALLENGE}%3D&code_challenge_method=S256`,
      `code_challenge=${CHALLENGE.slice(1)}&code_challenge_method=S256`,
      `code_challenge=${"a".repeat(64)}&code_challenge_method=S256`,
      `code_challenge=${CHALLENGE}&code_challenge=${CHALLENGE}&code_challenge_method=S256`,
      `code_challenge=${CHALLENGE}&code_challenge_method=S256&code_challenge_method=S256`,
    ]) {
      expect(
        connectRequest(new URLSearchParams(`${base}&${challenge}`)),
        challenge,
      ).toBeNull();
    }
  });

  test("is refused when either is missing, repeated, empty, or invalid", () => {
    for (const query of [
      "",
      `state=${STATE}`,
      "app=https%3A%2F%2Fmit-sdg.dev",
      `app=&state=${STATE}`,
      "app=https%3A%2F%2Fmit-sdg.dev&state=short",
      `app=https%3A%2F%2Fmit-sdg.dev&app=https%3A%2F%2Fevil.example&state=${STATE}`,
      `app=https%3A%2F%2Fmit-sdg.dev&state=${STATE}&state=${STATE}`,
    ]) {
      expect(connectRequest(new URLSearchParams(query))).toBeNull();
    }
  });
});

describe("returning to the app", () => {
  const callback = "https://mit-sdg.dev/auth/commons/callback";

  test("carries the code and the state back to the callback", () => {
    const url = new URL(
      approvedCallback(callback, "voucher.R-credential", STATE),
    );
    expect(`${url.origin}${url.pathname}`).toBe(callback);
    expect([...url.searchParams]).toEqual([
      ["code", "voucher.R-credential"],
      ["state", STATE],
    ]);
  });

  test("says the person declined, and still carries the state", () => {
    const url = new URL(deniedCallback(callback, STATE));
    expect(`${url.origin}${url.pathname}`).toBe(callback);
    expect([...url.searchParams]).toEqual([
      ["error", "access_denied"],
      ["state", STATE],
    ]);
  });

  test("encodes whatever it carries", () => {
    expect(approvedCallback(callback, "a&b", "c d")).toBe(
      `${callback}?code=a%26b&state=c%20d`,
    );
  });
});

test("a connected app is shown by its host", () => {
  expect(appHost("https://team-7.mit-sdg.dev")).toBe("team-7.mit-sdg.dev");
  expect(appHost("http://localhost:4311")).toBe("localhost:4311");
});
