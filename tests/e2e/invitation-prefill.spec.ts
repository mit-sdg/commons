import { expect, test } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";

for (const source of ["csv", "manual"] as const) {
  test(`${source} invitation prefills registration and accepts the entered temporary password`, async ({
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
    // Copying from an email can include surrounding spaces and tabs.
    const enteredCredential = source === "manual" ? ` \t${credential}\t ` : credential;

    // The browser is signed out, just as someone opening their invitation email is.
    await page.goto(`/register?invitation=${issued.invitation}`);
    await expect(page.getByRole("heading", { name: "Create your Commons account" })).toBeVisible();
    const name = page.getByLabel("Display name", { exact: true });
    const username = page.getByLabel("Username", { exact: true });
    const password = page.getByLabel("Temporary password", { exact: true });
    await expect(name).toHaveValue("");
    await password.fill(enteredCredential);
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
    await password.fill(enteredCredential);
    expect((await corrected).status()).toBe(200);
    await expect(name).toHaveValue("My chosen name");
    await expect(username).toHaveValue(`chosen_${source}`);
    await expect(password).toHaveValue(enteredCredential);

    // Acceptance must use the same credential as the successful preview, both
    // to verify the invitation and to set the account's initial password.
    const accepted = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/accept-invitation"),
    );
    await page.getByRole("button", { name: "Accept invitation", exact: true }).click();
    const acceptance = await accepted;
    expect(acceptance.status()).toBe(200);
    expect(acceptance.request().postDataJSON()).toEqual({
      invitation: issued.invitation,
      temporaryPassword: credential,
      username: `chosen_${source}`,
      password: credential,
      displayName: "My chosen name",
    });

    // Automatic sign-in must also use the trimmed credential and hold a session.
    await expect(page).toHaveURL("/");
    // APIRequestContext does not send Secure cookies over local HTTP itself.
    const browserHeaders = {
      Cookie: (await page.context().cookies())
        .map(({ name, value }) => `${name}=${value}`)
        .join("; "),
    };
    const me = await page.request.post("/api/auth/me", { headers: browserHeaders, data: {} });
    expect(me.ok()).toBe(true);
    expect(await me.json()).toMatchObject({ username: `chosen_${source}`, email });

    // Ordinary passwords can intentionally contain surrounding whitespace.
    // Changing and signing in with one must keep every character intact.
    const chosenPassword = "  my chosen password  ";
    const changed = await page.request.post("/api/auth/changePassword", {
      headers: browserHeaders,
      data: { oldPassword: credential, newPassword: chosenPassword },
    });
    expect(changed.ok()).toBe(true);
    await page.goto("/login");
    await page.getByLabel("Username", { exact: true }).fill(`chosen_${source}`);
    await page.getByLabel("Password", { exact: true }).fill(chosenPassword);
    const signedIn = page.waitForResponse((response) => response.url().endsWith("/api/auth/login"));
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const signIn = await signedIn;
    expect(signIn.request().postDataJSON()).toEqual({
      username: `chosen_${source}`,
      password: chosenPassword,
    });
    expect(signIn.status()).toBe(200);
    await expect(page).toHaveURL("/");
  });
}
