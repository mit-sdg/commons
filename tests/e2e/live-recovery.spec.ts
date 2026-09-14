import { expect, type Page, test } from "@playwright/test";

async function call<T>(page: Page, path: string, data: unknown): Promise<T> {
  const cookie = (await page.context().cookies())
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
  const response = await page.request.post(`/api${path}`, { data, headers: { Cookie: cookie } });
  const result = await response.json();
  expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
  expect(result.error, path).toBeUndefined();
  return result as T;
}

for (const form of ["relay", "questionnaire"] as const) {
  for (const surface of ["dashboard", "projector"] as const) {
    test(`${form} ${surface} retains its view after a failed poll, recovers, and clears on refusal`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.goto("/login");
      await page.getByRole("textbox", { name: "Username" }).fill("mara");
      await page.getByRole("textbox", { name: "Password" }).fill("password123");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/");

      const title = `Recovery ${form} ${surface}`;
      let run: string;
      if (form === "relay") {
        const { relay } = await call<{ relay: string }>(page, "/live/relays/plan", { title });
        await call(page, "/live/relays/add-round", {
          relay,
          title: "Ideas",
          prompt: "Suggest an improvement",
          parts: [],
          choices: [],
          cap: 0,
        });
        ({ run } = await call<{ run: string }>(page, "/live/relays/launch", { relay }));
      } else {
        const { questionnaire } = await call<{ questionnaire: string }>(
          page,
          "/live/quizzes/create",
          {
            title,
            form: "quiz",
            disclosure: "answers",
          },
        );
        await call(page, "/live/quizzes/add-question", {
          questionnaire,
          prompt: "What could improve?",
          choices: ["An improvement", "Nothing"],
          expected: "An improvement",
          explanation: "Any useful idea",
        });
        ({ run } = await call<{ run: string }>(page, "/live/runs/launch", { questionnaire }));
      }

      try {
        await page.goto(`/staff/live/run/${run}${surface === "projector" ? "/project" : ""}`);
        const heading = page.getByRole("heading", { name: title, exact: true });
        await expect(heading).toBeVisible();
        const endpoint = form === "relay" ? "**/api/live/relays/run" : "**/api/live/runs/results";
        const fault =
          surface === "projector" && form === "relay"
            ? "TIMED_OUT"
            : surface === "dashboard" && form === "questionnaire"
              ? "TRANSPORT_ERROR"
              : "NETWORK_ERROR";
        const stale = page.getByText(
          form === "questionnaire" && surface === "projector"
            ? "No connection."
            : /This (view|wall|board) is stale\./,
        );
        let polls = 0;
        let deny = false;
        let failBeforeRefusal = false;
        let failures = 0;
        let release!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const refusal =
          form === "relay" ? (surface === "dashboard" ? "UNAUTHORIZED" : "FORBIDDEN") : "NOT_FOUND";
        await page.route(endpoint, async (route) => {
          polls += 1;
          if (deny) {
            await route.fulfill({ json: { error: refusal } });
          } else if (polls === 1 || failBeforeRefusal) {
            // Cover both a real failed transport and resolved client fault envelopes.
            if (fault === "NETWORK_ERROR") await route.abort("failed");
            else await route.fulfill({ json: { error: fault } });
            failures += 1;
            if (failBeforeRefusal) deny = true;
          } else {
            // Keep the recovery response pending so an eventual assertion cannot
            // hide the board disappearing briefly after the failed request.
            await held;
            await route.continue();
          }
        });
        try {
          await expect(stale).toBeVisible();
          await expect(heading).toBeVisible();
          await expect
            .poll(() => polls, { message: "polling continues after the transport failure" })
            .toBeGreaterThanOrEqual(2);
          await expect(heading).toBeVisible();
          const recovered = page.waitForResponse(
            (response) =>
              response
                .url()
                .endsWith(form === "relay" ? "/api/live/relays/run" : "/api/live/runs/results") &&
              response.ok(),
          );
          release();
          await recovered;
          await expect(stale).toHaveCount(0);
          await expect(heading).toBeVisible();
          // A subsequent poll proves the successful recovery left polling alive.
          await expect.poll(() => polls).toBeGreaterThanOrEqual(3);
          // Losing access while stale data is retained must still clear it.
          failBeforeRefusal = true;
          await expect(stale).toBeVisible();
          await expect.poll(() => failures).toBe(2);
          await expect(heading).toBeVisible();
          const message =
            refusal === "UNAUTHORIZED"
              ? "Sign in and try again."
              : refusal === "FORBIDDEN"
                ? "You do not have permission to do that."
                : "That item is not available.";
          await expect(page.getByText(message, { exact: true })).toBeVisible();
          await expect(heading).toHaveCount(0);
        } finally {
          release();
          await page.unrouteAll({ behavior: "wait" });
        }
      } finally {
        await call(page, form === "relay" ? "/live/relays/close" : "/live/runs/close", { run });
      }
    });
  }
}
