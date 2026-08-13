import { describe, expect, test } from "vite-plus/test";
import { createEngine, type LogEvent } from "@mit-sdg/sync-engine/advanced";
import { commonsPublicErrors } from "../../src/assembly/http-policy.ts";
import { createEdge } from "../../src/edge.ts";
import { AuthenticatingConcept } from "../../src/concepts/authenticating/authenticating.ts";

describe("public failure vocabulary", () => {
  test("representative refusals declare their public categories", () => {
    expect(commonsPublicErrors.INVALID_CREDENTIALS).toBe("UNAUTHORIZED");
    expect(commonsPublicErrors.NOTE_NOT_FOUND).toBe("NOT_FOUND");
    expect(commonsPublicErrors.FORBIDDEN).toBe("FORBIDDEN");
    expect(commonsPublicErrors.USERNAME_TAKEN).toBe("CONFLICT");
  });

  test("the HTTP edge omits private details and rejects absent and invalid sessions alike", async () => {
    const edge = createEdge();
    const malformed = await edge.fetch(
      new Request("http://commons.test/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "INVALID_REQUEST" });

    for (const cookie of [undefined, "session=not-a-session"]) {
      const response = await edge.fetch(
        new Request("http://commons.test/api/auth/me", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookie === undefined ? {} : { Cookie: cookie }),
          },
          body: "{}",
        }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
    }
  });

  test("a concept or database fault becomes an opaque internal error", async () => {
    const logs: string[] = [];
    const ordinaryError = console.error;
    console.error = (...values: unknown[]) => logs.push(values.map(String).join(" "));
    class FaultingAuthentication extends AuthenticatingConcept {
      override async authenticate(_: {
        username: string;
        password: string;
      }): Promise<{ user: string }> {
        throw new Error("mongodb://operator:setup-secret@private-host/commons");
      }
    }
    try {
      const edge = createEdge({ Authenticating: new FaultingAuthentication() });
      const response = await edge.fetch(
        new Request("http://commons.test/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "someone", password: "raw-password" }),
        }),
      );
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('{"error":"INTERNAL_ERROR"}');
      expect(text).not.toMatch(/raw-password|setup-secret|private-host|mongodb/i);
    } finally {
      console.error = ordinaryError;
    }
    const captured = logs.join("\n");
    expect(captured).toContain('"name":"Error"');
    expect(captured).toContain('"actionId"');
    expect(captured).not.toMatch(/raw-password|setup-secret|private-host|mongodb|operator/i);
  });

  test("retained auth records and observer events contain [redacted] for credential fields", async () => {
    const retained: unknown[] = [];
    const engine = createEngine({
      logSink: { append: (entry) => (retained.push(entry), undefined) },
    });
    const authentication = engine.instrumentConcept(new AuthenticatingConcept(), "Authenticating");
    const events: LogEvent[] = [];
    engine.addObserver({ onAction: (event) => events.push(event) });

    const registerPassword = "register-password-sentinel";
    const loginPassword = "login-password-sentinel";
    const { user } = await authentication.register({
      username: "observer_user",
      password: registerPassword,
      email: "observer@example.edu",
    });
    await authentication.changePassword({
      user,
      oldPassword: registerPassword,
      newPassword: loginPassword,
    });
    await authentication.authenticate({ username: "observer_user", password: loginPassword });

    const retainedText = JSON.stringify(retained);
    const observed = JSON.stringify(events);
    for (const captured of [retainedText, observed]) {
      expect(captured).toContain("[redacted]");
      expect(captured).not.toContain(registerPassword);
      expect(captured).not.toContain(loginPassword);
    }

    class FaultingAuthentication extends AuthenticatingConcept {
      override async authenticate({
        password,
      }: {
        username: string;
        password: string;
      }): Promise<{ user: string }> {
        throw new Error(`driver-fault-${password}`);
      }
    }
    const faultEntries: unknown[] = [];
    const faultEngine = createEngine({
      logSink: { append: (entry) => (faultEntries.push(entry), undefined) },
    });
    const faulting = faultEngine.instrumentConcept(new FaultingAuthentication(), "Authenticating");
    const faultPassword = "fault-password-sentinel";
    await expect(
      faulting.authenticate({ username: "observer_user", password: faultPassword }),
    ).rejects.toThrow();
    const faulted = JSON.stringify(faultEntries);
    expect(faulted).toContain("UNKNOWN_ERROR");
    expect(faulted).toContain("[redacted]");
    expect(faulted).not.toContain(faultPassword);
    expect(faulted).not.toContain("driver-fault");
  });
});
