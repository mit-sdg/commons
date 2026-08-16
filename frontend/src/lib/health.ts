type FetchBackend = (input: URL, init: RequestInit) => Promise<Response>;

const response = (status: "ok" | "unavailable", httpStatus: 200 | 503) =>
  Response.json(
    { status },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );

export async function backendReadinessResponse(
  fetchBackend: FetchBackend = fetch,
  backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:4000",
): Promise<Response> {
  try {
    const readiness = await fetchBackend(
      new URL("/health/ready", backendOrigin),
      {
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
      },
    );
    return readiness.ok ? response("ok", 200) : response("unavailable", 503);
  } catch {
    return response("unavailable", 503);
  }
}
