import { describe, expect, test, vi } from "vite-plus/test";
import { backendReadinessResponse } from "@/lib/health";

const backendOrigin = "http://127.0.0.1:4000";

describe("public health", () => {
  test("reports healthy only after a fresh successful backend readiness check", async () => {
    const fetchBackend = vi.fn(async (input: URL, init: RequestInit) => {
      void input;
      void init;
      return new Response(null, { status: 200 });
    });

    const result = await backendReadinessResponse(fetchBackend, backendOrigin);

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: "ok" });
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(fetchBackend).toHaveBeenCalledOnce();
    const [url, options] = fetchBackend.mock.calls[0] ?? [];
    expect(String(url)).toBe(`${backendOrigin}/health/ready`);
    expect(options).toMatchObject({ cache: "no-store" });
  });

  test("reports unavailable when the backend is not ready", async () => {
    const fetchBackend = vi.fn(async (input: URL, init: RequestInit) => {
      void input;
      void init;
      return new Response(null, { status: 503 });
    });

    const result = await backendReadinessResponse(fetchBackend, backendOrigin);

    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ status: "unavailable" });
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  test("reports unavailable without disclosing backend failures", async () => {
    const fetchBackend = vi.fn(async (input: URL, init: RequestInit) => {
      void input;
      void init;
      throw new Error("mongodb://operator:connection-secret@mongo/class");
    });

    const result = await backendReadinessResponse(fetchBackend, backendOrigin);
    const body = await result.text();

    expect(result.status).toBe(503);
    expect(body).toBe('{"status":"unavailable"}');
    expect(body).not.toContain("secret");
  });
});
