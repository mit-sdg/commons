import { expect, test } from "@playwright/test";

test("search asks for two characters, finds replies and discussions posted since the list loaded or since the last search, and says when filters hide matches", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const login = await page.request.post("/api/auth/login", {
    data: { username: "mara", password: "password123" },
  });
  expect(login.ok()).toBe(true);
  const cookie = login.headers()["set-cookie"]!.split(";")[0]!;
  const call = async (path: string, data: unknown) => {
    const response = await page.request.post(`/api${path}`, { headers: { Cookie: cookie }, data });
    const body = await response.json();
    expect(response.ok(), `${path}: ${JSON.stringify(body)}`).toBe(true);
    return body;
  };
  const word = `quokka${Date.now()}`;
  const opening = await call("/threads/create", {
    holders: ["standing:everyone"],
    content: "# Office hours this week\nSame room as before.",
  });
  await call("/threads/reply", { parent: opening.node, content: `Bring your ${word} questions.` });

  await page.goto("/");
  const box = page.getByLabel("Search discussions");
  await box.fill("q");
  await expect(page.getByText("Type at least 2 characters to search.")).toBeVisible();

  await box.fill(word);
  await expect(page.getByText(`1 discussion matches “${word}”`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Office hours this week" })).toBeVisible();

  // Posted after the list loaded: the search still finds it.
  await call("/threads/create", {
    holders: ["standing:everyone"],
    content: `# Late ${word} news\nPosted after the page loaded.`,
  });
  const shorter = word.slice(0, -1);
  await box.fill(shorter);
  await expect(page.getByText(`2 discussions match “${shorter}”`)).toBeVisible();
  await expect(page.getByRole("link", { name: `Late ${word} news` })).toBeVisible();

  // The same search again, after another discussion is posted, finds that one too.
  await call("/threads/create", {
    holders: ["standing:everyone"],
    content: `# Later ${word} news\nPosted after the first search.`,
  });
  await page.getByRole("button", { name: "Clear search" }).click();
  await box.fill(shorter);
  await expect(page.getByText(`3 discussions match “${shorter}”`)).toBeVisible();
  await expect(page.getByRole("link", { name: `Later ${word} news` })).toBeVisible();

  await page.getByRole("button", { name: "Private" }).click();
  await expect(page.getByText("Your filters hide all 3 matches")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(box).toHaveValue("");
});
