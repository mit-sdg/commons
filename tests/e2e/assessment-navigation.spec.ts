import { expect, test } from "@playwright/test";

test("attempt links reveal work, tabs retain edits, and label failures preserve assignment saves", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const staff = await browser.newContext();
  const student = await browser.newContext();
  try {
    const cookies = new Map<typeof staff, string>();
    const call = async (context: typeof staff, path: string, data = {}) => {
      const response = await context.request.post(`http://127.0.0.1:3755/api${path}`, {
        headers: cookies.has(context) ? { Cookie: cookies.get(context)! } : {},
        data,
      });
      const cookie = response.headers()["set-cookie"]?.split(";")[0];
      if (cookie) cookies.set(context, cookie);
      const result = await response.json();
      expect(response.ok(), `${path}: ${JSON.stringify(result)}`).toBe(true);
      expect(result).not.toHaveProperty("error");
      return result;
    };
    await call(staff, "/auth/login", { username: "mara", password: "password123" });
    await call(staff, "/roster/import", {
      rows: [{ email: "noah@example.edu", kind: "STUDENT" }],
    });
    await call(student, "/auth/login", { username: "noah", password: "password123" });
    const { assignment } = await call(staff, "/assignments/create-draft", {
      title: "Navigation regression",
      instructions: "Explain your claim",
      kind: "EXERCISE",
      availableAt: "2020-01-01T00:00:00Z",
      dueAt: "2090-01-01T00:00:00Z",
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
    });
    const { edition } = await call(staff, "/grades/define-standard", {
      name: "Reasoning",
      description: "",
      deficient: "",
      emergent: "",
      competent: "",
      expert: "",
      referenceUrl: "",
    });
    await call(staff, "/grades/add-criterion", { item: assignment, basis: edition, position: 0 });
    await call(staff, "/assignments/publish", { assignment });
    const { submission } = await call(student, "/assignments/submit", {
      assignment,
      content: "Evidence to assess",
    });
    const page = await staff.newPage();
    await page.goto(`http://127.0.0.1:3755/staff/assignments/${assignment}#attempt-${submission}`);
    await expect(page.getByRole("tab", { name: "Submissions", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Evidence to assess", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Assess this attempt" }).click();
    await page.getByRole("button", { name: "Start assessment", exact: true }).click();
    const feedback = page.getByRole("textbox", { name: "Overall feedback (optional)" });
    const rating = page.getByRole("combobox", { name: "Assessment", exact: true });
    await rating.selectOption("COMPETENT");
    await feedback.fill("Unsaved feedback survives a rubric consultation");
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(feedback).toBeHidden();
    await page.getByRole("tab", { name: "Student preview", exact: true }).click();
    await expect(feedback).toBeHidden();
    await page.getByRole("tab", { name: "Submissions", exact: true }).click();
    await expect(feedback).toHaveValue("Unsaved feedback survives a rubric consultation");
    await expect(rating).toHaveValue("COMPETENT");

    await page.route("**/api/grades/configure-item", (route) =>
      route.fulfill({ json: { error: "FORBIDDEN" } }),
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("Renamed assignment");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Renamed assignment" })).toBeVisible();
    await expect(page.getByText(/Assignment saved, but its assessment label/)).toBeVisible();
    const saved = await call(staff, "/assignments/staff-summary", { assignment });
    expect(saved.summary.title).toBe("Renamed assignment");
  } finally {
    await staff.close();
    await student.close();
  }
});
