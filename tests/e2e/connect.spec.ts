import { expect, type Page } from "@playwright/test";
import { authenticate, test } from "./support/browser";

/**
 * Apps on this machine are always accepted, and nothing listens at these
 * ports: the browser's arrival at each callback is intercepted, so the test
 * sees exactly where Commons sent it.
 */
const app = (port: number) => `http://localhost:${port}`;
const callbackOf = (origin: string) => `${origin}/auth/commons/callback`;
const newState = () => `e2e-${crypto.randomUUID()}`;

/** RFC 7636, Appendix B: the verifier an app keeps, and the challenge it sends. */
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

async function arriveAtApps(page: Page) {
  await page.route("http://localhost:*/auth/commons/callback**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<p>Back at the app</p>" }),
  );
}

function connectPath(origin: string, state: string, challenge: string | null = CHALLENGE) {
  const path = `/connect?app=${encodeURIComponent(origin)}&state=${encodeURIComponent(state)}`;
  return challenge === null
    ? path
    : `${path}&code_challenge=${challenge}&code_challenge_method=S256`;
}

test("a person allows an app once, and later sign-ins go straight through", async ({ page }) => {
  await authenticate(page);
  await arriveAtApps(page);
  const origin = app(4791);

  const firstState = newState();
  const response = await page.goto(connectPath(origin, firstState));
  expect(response?.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  // The development server marks every page `no-cache` itself; the built
  // frontend serves the configured header.
  if (process.env.CI || process.env.COMMONS_E2E_STANDALONE === "1") {
    expect(response?.headers()["cache-control"]).toBe("private, no-store");
  }

  await expect(page.getByRole("heading", { name: "localhost:4791" })).toBeVisible();
  await expect(page.getByText(origin, { exact: true })).toBeVisible();
  await expect(page.getByText("This app will learn")).toBeVisible();
  await expect(page.getByText("mara@example.edu")).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);

  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${callbackOf(origin)}?**`);
  const allowed = new URL(page.url());
  expect(allowed.searchParams.get("state")).toBe(firstState);
  const code = allowed.searchParams.get("code");
  expect(code).toMatch(/^[A-Za-z0-9._-]{1,128}$/);

  // The app's server trades the code and its verifier for the person, once.
  const redemption = { code, app: origin, code_verifier: VERIFIER };
  const redeemed = await page.request.post("/api/connect/redeem", { data: redemption });
  expect(redeemed.status()).toBe(200);
  expect(await redeemed.json()).toMatchObject({ username: "mara", email: "mara@example.edu" });
  const again = await page.request.post("/api/connect/redeem", { data: redemption });
  expect(again.status()).toBe(400);
  expect(await again.json()).toEqual({ error: "CONNECT_CODE_INVALID" });

  const secondState = newState();
  await page.goto(connectPath(origin, secondState));
  await page.waitForURL(`${callbackOf(origin)}?**`);
  const returning = new URL(page.url());
  expect(returning.searchParams.get("state")).toBe(secondState);
  expect(returning.searchParams.get("code")).not.toBe(code);
  expect(returning.searchParams.get("error")).toBeNull();
});

test("cancelling returns the person to the app with no code", async ({ page }) => {
  await authenticate(page);
  await arriveAtApps(page);
  const origin = app(4792);
  const state = newState();

  await page.goto(connectPath(origin, state));
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForURL(`${callbackOf(origin)}?**`);
  const declined = new URL(page.url());
  expect([...declined.searchParams]).toEqual([
    ["error", "access_denied"],
    ["state", state],
  ]);
});

test("a request naming no acceptable app or state goes nowhere", async ({ page }) => {
  await authenticate(page);
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  for (const path of [
    connectPath("https://evil.example", newState()),
    connectPath(app(4793), "too-short"),
    connectPath(app(4793), newState(), null),
    connectPath(app(4793), newState(), CHALLENGE.slice(1)),
    `/connect?app=${encodeURIComponent(app(4793))}`,
    "/connect",
  ]) {
    await page.goto(path);
    await expect(page.getByText("This app can't use Commons sign-in.")).toBeVisible();
  }
  expect(navigations.every((url) => new URL(url).port === "3755")).toBe(true);
});

test("a signed-out person signs in first and returns to the question", async ({ page }) => {
  await arriveAtApps(page);
  const origin = app(4794);
  const state = newState();
  await page.goto(connectPath(origin, state));
  await page.waitForURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(connectPath(origin, state));

  await page.getByLabel("Username", { exact: true }).fill("noah");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "localhost:4794" })).toBeVisible();
  await expect(page.getByText("noah@example.edu")).toBeVisible();
  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${callbackOf(origin)}?**`);
  expect(new URL(page.url()).searchParams.get("state")).toBe(state);
});

test("a connected app is listed in Settings until it is removed", async ({ page }) => {
  await authenticate(page, "priya");
  await arriveAtApps(page);
  const origin = app(4795);

  await page.goto("/settings");
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "Connected apps" }),
  });
  await expect(section.getByText("No apps can sign you in yet.")).toBeVisible();

  await page.goto(connectPath(origin, newState()));
  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(`${callbackOf(origin)}?**`);

  await page.goto("/settings");
  await expect(section.getByText("localhost:4795", { exact: true })).toBeVisible();
  await expect(section.getByText(origin, { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Remove" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  await expect(section.getByText("No apps can sign you in yet.")).toBeVisible();

  // Removing the approval means the app has to ask again.
  await page.goto(connectPath(origin, newState()));
  await expect(page.getByRole("button", { name: "Allow" })).toBeVisible();
});
