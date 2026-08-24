import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

const password = "original-password";

async function registeredUser(
  edge: ReturnType<typeof createEdge>,
  username: string,
  email: string,
) {
  const registered = await edge.application.concepts.Authenticating.register({
    username,
    password,
    email,
  });
  if ("error" in registered) throw new Error(String(registered.error));
  return registered.user;
}

function resetCodeIn(text: string): string {
  const match = text.match(/Reset code: (R-[A-Za-z0-9_-]+)/);
  if (match === null) throw new Error("no reset code in mail text");
  return match[1];
}

describe("password reset", () => {
  test("a reset email lets its holder replace the password once", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    await registeredUser(edge, "resetting_member", "member@example.edu");

    const login = await edge.gateway.invoke("/auth/login", {
      username: "resetting_member",
      password,
    });
    if (!login.ok) throw new Error("could not sign in");
    const oldSession = (login.value as { session: string }).session;

    const requested = await edge.gateway.invoke("/auth/request-password-reset", {
      email: " Member@Example.EDU ",
    });
    if (!requested.ok) throw new Error("request was not accepted");
    expect(requested.value).toEqual({ ok: true });
    await edge.application.whenIdle();

    const pending = await edge.application.concepts.Mailing._getPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0].recipient).toBe("member@example.edu");
    expect(pending[0].subject).toBe("Reset your Commons password");
    expect(pending[0].text).toContain(`/reset-password?voucher=${pending[0].key}`);
    expect(pending[0].text).toContain("resetting_member");
    const voucher = pending[0].key as string;
    const credential = resetCodeIn(pending[0].text);
    expect(pending[0].text).not.toContain(`voucher=${credential}`);

    const reset = await edge.gateway.invoke("/auth/reset-password", {
      voucher,
      credential,
      newPassword: "replacement-password",
    });
    expect(reset.ok).toBe(true);
    await edge.application.whenIdle();

    const staleSession = await edge.gateway.invoke("/auth/me", { session: oldSession });
    expect(staleSession.ok).toBe(false);

    const oldPassword = await edge.gateway.invoke("/auth/login", {
      username: "resetting_member",
      password,
    });
    expect(oldPassword.ok).toBe(false);

    const newPassword = await edge.gateway.invoke("/auth/login", {
      username: "resetting_member",
      password: "replacement-password",
    });
    expect(newPassword.ok).toBe(true);

    const again = await edge.gateway.invoke("/auth/reset-password", {
      voucher,
      credential,
      newPassword: "third-password",
    });
    expect(again.ok).toBe(false);
  });

  test("an unknown address receives the same acceptance and no mail", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    await registeredUser(edge, "lone_member", "lone@example.edu");

    const requested = await edge.gateway.invoke("/auth/request-password-reset", {
      email: "stranger@example.edu",
    });
    if (!requested.ok) throw new Error("request was not accepted");
    expect(requested.value).toEqual({ ok: true });
    await edge.application.whenIdle();

    expect(await edge.application.concepts.Mailing._getPending({})).toHaveLength(0);
  });

  test("a malformed address is refused", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const requested = await edge.gateway.invoke("/auth/request-password-reset", {
      email: "not-an-address",
    });
    expect(requested.ok).toBe(false);
  });

  test("a refused new password leaves the voucher usable", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    await registeredUser(edge, "careful_member", "careful@example.edu");

    await edge.gateway.invoke("/auth/request-password-reset", {
      email: "careful@example.edu",
    });
    await edge.application.whenIdle();
    const pending = await edge.application.concepts.Mailing._getPending({});
    expect(pending).toHaveLength(1);
    const voucher = pending[0].key as string;
    const credential = resetCodeIn(pending[0].text);

    const short = await edge.gateway.invoke("/auth/reset-password", {
      voucher,
      credential,
      newPassword: "short",
    });
    expect(short.ok).toBe(false);

    const valid = await edge.gateway.invoke("/auth/reset-password", {
      voucher,
      credential,
      newPassword: "acceptable-password",
    });
    expect(valid.ok).toBe(true);
  });

  test("an address reaches the one account holding it", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    await registeredUser(edge, "first_holder", "shared@example.edu");

    // An address identifies at most one account, so no second account can hold
    // it and a request can never fan out to more than one voucher.
    const second = await edge.application.concepts.Authenticating.register({
      username: "second_holder",
      password,
      email: "Shared@Example.edu",
    });
    expect("error" in second).toBe(true);

    const requested = await edge.gateway.invoke("/auth/request-password-reset", {
      email: "shared@example.edu",
    });
    expect(requested.ok).toBe(true);
    await edge.application.whenIdle();

    const pending = await edge.application.concepts.Mailing._getPending({});
    expect(pending).toHaveLength(1);
    expect(pending[0].text).toContain("first_holder");
  });

  test("a lapsed voucher is refused", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const user = await registeredUser(edge, "late_member", "late@example.edu");

    const issued = await edge.application.concepts.Vouching.issue({
      subject: user,
      at: new Date("2020-01-01T00:00:00Z"),
      expiresAt: new Date("2020-01-01T01:00:00Z"),
    });
    if ("error" in issued) throw new Error(String(issued.error));
    await edge.application.whenIdle();

    const reset = await edge.gateway.invoke("/auth/reset-password", {
      voucher: issued.voucher,
      credential: issued.credential,
      newPassword: "replacement-password",
    });
    expect(reset.ok).toBe(false);
  });
});
