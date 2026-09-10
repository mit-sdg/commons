import { expect, test } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";

for (const source of ["csv", "manual"] as const) {
  test(`${source} invitation prefills registration as soon as the temporary password is entered`, async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    const login = await request.post("/api/auth/login", {
      data: { username: "mara", password: "password123" },
    });
    expect(login.ok()).toBe(true);
    const headers = { Cookie: login.headers()["set-cookie"]!.split(";")[0]! };
    const email = `prefill_${source}@example.edu`;
    const displayName = source === "csv" ? "Nina Okafor" : "Jamie Doe";
    if (source === "csv") {
      const preview = await request.post("/api/roster/import-preview", {
        headers,
        data: { csv: `email,kind,section,displayName\n${email},STUDENT,,${displayName}` },
      });
      expect(preview.ok()).toBe(true);
      const imported = await request.post("/api/roster/import", {
        headers,
        data: { rows: (await preview.json()).rows },
      });
      expect(imported.ok()).toBe(true);
    } else {
      const added = await request.post("/api/roster/add-person", {
        headers,
        data: { email, displayName, kind: "STUDENT" },
      });
      expect(added.ok()).toBe(true);
    }
    const pending = await request.post("/api/roster/pending", { headers, data: {} });
    expect((await pending.json()).members).toContainEqual(
      expect.objectContaining({ email, displayName }),
    );
    const invitations = await request.post("/api/invitations/list", { headers, data: {} });
    const issued = (await invitations.json()).invitations.find(
      (invitation: { address: string }) => invitation.address === email,
    );
    expect(issued).toBeDefined();
    const credential = invitationCredential(issued.invitation);

    // The browser is signed out, just as someone opening their invitation email is.
    await page.goto(`/register?invitation=${issued.invitation}`);
    await expect(page.getByRole("heading", { name: "Create your Commons account" })).toBeVisible();
    const name = page.getByLabel("Display name", { exact: true });
    const username = page.getByLabel("Username", { exact: true });
    const password = page.getByLabel("Temporary password", { exact: true });
    await expect(name).toHaveValue("");
    await password.fill(credential);
    // Pasting the credential must not require an extra click or tab to start the lookup.
    await expect(name).toHaveValue(displayName);
    await expect(username).toHaveValue(`prefill_${source}`);
    await expect(password).toBeFocused();
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    // Correcting a credential retries the lookup without replacing chosen account details.
    await name.fill("My chosen name");
    await username.fill(`chosen_${source}`);
    const invalid = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/invitation"),
    );
    await password.fill("not-the-temporary-password");
    expect((await invalid).status()).toBe(401);
    const corrected = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/invitation"),
    );
    await password.fill(credential);
    expect((await corrected).status()).toBe(200);
    await expect(name).toHaveValue("My chosen name");
    await expect(username).toHaveValue(`chosen_${source}`);
  });
}
