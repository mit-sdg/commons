import { expect, test } from "@playwright/test";

test("skills refresh without clearing a draft, and graders can open unassessed assignments", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const staff = await browser.newContext();
  const grader = await browser.newContext();
  try {
    const login = await staff.request.post("http://127.0.0.1:3755/api/auth/login", {
      data: { username: "mara", password: "password123" },
    });
    expect(login.ok()).toBe(true);
    const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
    const call = async (path: string, data: unknown) => {
      const response = await staff.request.post(`http://127.0.0.1:3755/api${path}`, {
        headers: { Cookie: cookie },
        data,
      });
      const result = await response.json();
      expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
      expect(result).not.toHaveProperty("error");
      return result;
    };
    // Warm routes before typing so dev compilation cannot reload away the draft.
    for (const route of ["/staff/skills", "/staff/assignments/new", "/staff/gradebook"])
      await staff.request.get(`http://127.0.0.1:3755${route}`);
    const page = await staff.newPage();
    await page.goto("http://127.0.0.1:3755/staff/assignments/new");
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Unassessed work");
    const popup = staff.waitForEvent("page");
    await page.getByRole("link", { name: "Manage skills & rubrics" }).click();
    const skills = await popup;
    await skills.getByRole("button", { name: "New skill", exact: true }).click();
    await skills
      .getByRole("textbox", { name: "Skill name", exact: true })
      .fill("Fresh reasoning skill");
    await skills.getByRole("button", { name: "Save edition", exact: true }).click();
    await expect(skills.getByText("Fresh reasoning skill", { exact: true })).toBeVisible();
    await page.bringToFront();
    // Headless Chromium does not consistently emit OS window-focus events.
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(page.getByRole("textbox", { name: "Title", exact: true })).toHaveValue(
      "Unassessed work",
    );
    const choice = page.getByRole("checkbox", { name: "Fresh reasoning skill" });
    await choice.check();
    const { standards } = await call("/grades/standards", {});
    const original = standards.find((r: { name: string }) => r.name === "Fresh reasoning skill")!;
    await call("/grades/revise-standard", {
      standard: original.standard,
      expectedEdition: original.edition,
      name: "Revised reasoning skill",
      description: "",
      deficient: "",
      emergent: "",
      competent: "",
      expert: "",
      referenceUrl: "",
    });
    await skills.bringToFront();
    await page.bringToFront();
    // Headless Chromium does not consistently emit OS window-focus events.
    await page.evaluate("window.dispatchEvent(new Event('focus'))");
    await expect(choice).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Revised reasoning skill" })).toHaveCount(0);
    await page.getByRole("button", { name: "Create draft", exact: true }).click();
    await page.waitForURL(/\/staff\/assignments\/[\da-f-]+$/);
    const assignment = page.url().split("/").at(-1)!;
    await call("/assignments/publish", { assignment });
    const { role } = await call("/roles/define", {
      name: "Assessment-only reviewer",
      capabilities: ["grade"],
    });
    await call("/roles/assign", { user: "noah@example.edu", context: "commons", role });
    const graderLogin = await grader.request.post("http://127.0.0.1:3755/api/auth/login", {
      data: { username: "noah", password: "password123" },
    });
    expect(graderLogin.ok()).toBe(true);
    const review = await grader.newPage();
    await review.goto("http://127.0.0.1:3755/staff/gradebook");
    await review.getByText("Assess an assignment", { exact: true }).click();
    await review.getByRole("link", { name: "Unassessed work", exact: true }).click();
    await expect(
      review.getByRole("heading", { name: "Unassessed work", exact: true }),
    ).toBeVisible();
    await expect(review.getByRole("tab", { name: "Submissions", exact: true })).toBeVisible();
    await expect(review.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  } finally {
    await staff.close();
    await grader.close();
  }
});
