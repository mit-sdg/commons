import { type Browser, expect, type Locator, type Page } from "@playwright/test";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";
import { authenticate, call, logIn, test } from "./support/browser.ts";

/**
 * Team submissions in the browser: a team is a section, and an assignment is
 * submitted by each student or by each team. Each test sets its scene through
 * the routes the pages call, with its own teams and students, and then drives
 * the pages for the act under test.
 */

const DAY = 86_400_000;
const run = Date.now().toString(36).slice(-5);
let people = 0;

interface Person {
  user: string;
  username: string;
  name: string;
  email: string;
}

interface Published {
  assignment: string;
  criterion: string;
  revision: number;
  draft: Record<string, unknown>;
}

/** The administrator's page, used to set each scene through the API. */
async function staffScene(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { cookie } = await authenticate(page);
  const post = <T>(path: string, data: unknown) => call<T>(page, cookie, path, data);

  async function person(name: string): Promise<Person> {
    people += 1;
    const username = `${name.split(" ")[0]!.toLowerCase()}_${run}${people}`;
    const email = `${username}@example.edu`;
    const { invitation } = await post<{ invitation: string }>("/invitations/invite", { email });
    const { user } = await post<{ user: string }>("/auth/accept-invitation", {
      invitation,
      temporaryPassword: invitationCredential(invitation),
      username,
      password: "password123",
      displayName: name,
    });
    return { user, username, name, email };
  }

  async function team(name: string) {
    const created = await post<{ section: { _id: string } | string }>("/roster/sections/create", {
      name,
      location: "",
      meetingPattern: "",
    });
    return typeof created.section === "string" ? created.section : created.section._id;
  }

  /** Enrol students, each on the team given or on none. */
  async function enrol(rows: [Person, string | null][]) {
    await post("/roster/import", {
      rows: rows.map(([student, section]) => ({
        email: student.email,
        kind: "STUDENT",
        displayName: student.name,
        ...(section ? { section } : {}),
      })),
    });
  }

  async function grader(name: string) {
    const account = await person(name);
    const roles = await post<{ roles: { role: string; name: string }[] }>("/roles/list", {});
    const role =
      roles.roles.find((entry) => entry.name === "Course grader")?.role ??
      (
        await post<{ role: string }>("/roles/define", {
          name: "Course grader",
          capabilities: ["grade"],
        })
      ).role;
    await post("/roles/assign", { user: account.user, context: "commons", role });
    return account;
  }

  /** A published assignment for everyone, open now and due in a week, with a ten-point setup. */
  async function publish(title: string, submittedBy: "STUDENT" | "SECTION"): Promise<Published> {
    const now = Date.now();
    const draft = {
      title,
      instructions: "Hand in one page.",
      kind: "EXERCISE",
      availableAt: new Date(now - DAY).toISOString(),
      dueAt: new Date(now + 7 * DAY).toISOString(),
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
      submittedBy,
    };
    const { assignment } = await post<{ assignment: string }>("/assignments/create-draft", draft);
    const setup = await post<{ revision: number; criteria: { criterion: string }[] }>(
      "/grades/configure-setup",
      {
        item: assignment,
        method: "POINTS",
        revision: 0,
        criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
      },
    );
    await post("/assignments/publish", { assignment });
    return {
      assignment,
      criterion: setup.criteria[0]!.criterion,
      revision: setup.revision,
      draft,
    };
  }

  /** Record and save a points assessment of one attempt, and release it when asked. */
  async function assess(
    target: Published,
    learner: Person,
    evidence: string,
    score: number,
    release: boolean,
  ) {
    const recorded = await post<{ grade: string; version: number }>("/grades/record", {
      learner: learner.user,
      item: target.assignment,
      evidence,
      revision: target.revision,
    });
    const saved = await post<{ version: number }>("/grades/save", {
      grade: recorded.grade,
      version: recorded.version,
      judgments: [{ kind: "POINTS", criterion: target.criterion, score }],
      feedback: `Scored ${score}.`,
    });
    if (release) await post("/grades/release", { grade: recorded.grade, version: saved.version });
  }

  async function submittedBy(assignment: string) {
    const { summary } = await post<{ summary: { submittedBy?: string } }>(
      "/assignments/staff-summary",
      { assignment },
    );
    return summary.submittedBy;
  }

  return { context, page, post, person, team, enrol, grader, publish, assess, submittedBy };
}

/** A page signed in as someone, in a context of its own. */
async function signedIn(browser: Browser, username: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const session = await authenticate(page, username);
  return { context, page, cookie: session.cookie };
}

/** Hand in work through the API, as the student, from a context of their own. */
async function submitAs(browser: Browser, student: Person, assignment: string, content: string) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const { cookie } = await logIn(page, student.username);
    return (
      await call<{ submission: string }>(page, cookie, "/assignments/submit", {
        assignment,
        content,
      })
    ).submission;
  } finally {
    await context.close();
  }
}

/** One row of the staff page's Submissions list, found by the student's or team's name. */
function submitterRow(page: Page, name: string): Locator {
  return page
    .getByText(name, { exact: true })
    .locator(
      "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-lg ')][1]",
    );
}

/** The Team card beside a student's assignment. */
function teamCard(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Team", { exact: true }) });
}

const SUBMITTED = /^submitted$/i;
const RELEASED = /^released$/i;

test("a manager chooses that each team submits, and is asked before a change hides submitted work", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const staff = await staffScene(browser);
  try {
    const tidepool = await staff.team("Tidepool");
    const sam = await staff.person("Sam Okafor");
    const maya = await staff.person("Maya Lindqvist");
    await staff.enrol([
      [sam, tidepool],
      [maya, tidepool],
    ]);
    const pitch = await staff.publish("Project pitch", "STUDENT");
    const samPitch = await submitAs(browser, sam, pitch.assignment, "Sam's pitch.");
    await submitAs(browser, maya, pitch.assignment, "Maya's pitch.");
    await staff.assess(pitch, sam, samPitch, 7, false);
    const quiet = await staff.publish("Team charter", "STUDENT");

    const page = staff.page;

    // Creating: Submitted by is saved as Each team.
    await page.goto("/staff/assignments/new");
    await page.getByLabel("Title").fill("Design review");
    await page.getByLabel("Submitted by").click();
    await page.getByRole("option", { name: "Each team" }).click();
    await expect(page.getByLabel("Submitted by")).toHaveText("Each team");
    await page.getByRole("button", { name: "Points", exact: true }).click();
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Design review" })).toBeVisible();
    await expect(page.getByText("submitted by each team", { exact: true })).toBeVisible();
    const created = page.url().split("/staff/assignments/")[1]!.split(/[?#]/)[0]!;
    expect(await staff.submittedBy(created)).toBe("SECTION");

    // Changing work two teammates already submitted on their own asks first.
    await page.goto(`/staff/assignments/${pitch.assignment}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assignment" })).toBeVisible();
    await expect(page.getByLabel("Submitted by")).toHaveText("Each student");
    await page.getByLabel("Submitted by").click();
    await page.getByRole("option", { name: "Each team" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    const asking = page.getByRole("dialog", { name: "Change to each team?" });
    await expect(asking).toContainText(
      "2 students on 1 team have already submitted on their own, and 1 of those submissions is graded. Students stop seeing their own submission until it is moved to their team.",
    );
    await asking.getByRole("button", { name: "Cancel" }).click();
    await expect(asking).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Edit assignment" })).toBeVisible();
    expect(await staff.submittedBy(pitch.assignment)).toBe("STUDENT");

    await page.getByRole("button", { name: "Save changes" }).click();
    await asking.getByRole("button", { name: "Change to each team" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Project pitch" })).toBeVisible();
    await expect(page.getByText("submitted by each team", { exact: true })).toBeVisible();
    expect(await staff.submittedBy(pitch.assignment)).toBe("SECTION");

    // Nobody submitted: the change saves without asking.
    await page.goto(`/staff/assignments/${quiet.assignment}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Submitted by").click();
    await page.getByRole("option", { name: "Each team" }).click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Team charter" })).toBeVisible();
    await expect(page.getByText("submitted by each team", { exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await staff.submittedBy(quiet.assignment)).toBe("SECTION");
  } finally {
    await staff.context.close();
  }
});

test("a teammate reads the attempt another member handed in for their team", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const staff = await staffScene(browser);
  const opened: { close: () => Promise<void> }[] = [staff.context];
  try {
    const quillwork = await staff.team("Quillwork");
    const leila = await staff.person("Leila Farouk");
    const tomas = await staff.person("Tomas Ibarra");
    const wen = await staff.person("Wen Zhao");
    await staff.enrol([
      [leila, quillwork],
      [tomas, quillwork],
      [wen, null],
    ]);
    const title = "Concept inventory";
    const { assignment } = await staff.publish(title, "SECTION");

    // Leila hands in the team's work on the assignment's page.
    const leilaPage = await signedIn(browser, leila.username);
    opened.push(leilaPage.context);
    await leilaPage.page.goto(`/assignments/${assignment}`);
    await expect(leilaPage.page.getByText("Submit for Quillwork", { exact: true })).toBeVisible();
    await leilaPage.page
      .getByPlaceholder("Write your submission…")
      .fill("Draft, Margin note, and Round, with their purposes.");
    await leilaPage.page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      leilaPage.page.getByText("Resubmit for Quillwork (Attempt #2)", { exact: true }),
    ).toBeVisible();

    // Tomas reads the team, who handed it in, and the attempt.
    const tomasPage = await signedIn(browser, tomas.username);
    opened.push(tomasPage.context);
    const page = tomasPage.page;
    await page.goto(`/assignments/${assignment}`);
    const card = teamCard(page);
    await expect(card.getByText("Quillwork", { exact: true })).toBeVisible();
    await expect(card.getByRole("listitem")).toHaveCount(2);
    await expect(card.getByRole("listitem").filter({ hasText: "Leila Farouk" })).toBeVisible();
    await expect(card.getByRole("listitem").filter({ hasText: "Tomas Ibarra" })).toContainText(
      "you",
    );
    const status = card.getByText(SUBMITTED);
    await expect(status).toBeVisible();
    await expect(status.locator("xpath=..")).toContainText("Leila Farouk");
    const attempt = page.locator("details").filter({ hasText: "Attempt #1" });
    await expect(attempt).toHaveCount(1);
    await expect(attempt.locator("summary")).toContainText("Leila Farouk");
    await attempt.locator("summary").click();
    await expect(attempt).toContainText("Draft, Margin note, and Round, with their purposes.");
    await expect(
      page.getByText("Resubmit for Quillwork (Attempt #2)", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Late days", { exact: true })).toHaveCount(0);

    // Tomas's list reads Submitted and names the team.
    await page.goto("/assignments");
    const row = page.getByRole("link").filter({ hasText: title });
    await expect(row.getByText(SUBMITTED)).toBeVisible();
    await expect(row).toContainText("with Quillwork");

    // A student on no team submits on their own.
    const wenPage = await signedIn(browser, wen.username);
    opened.push(wenPage.context);
    await wenPage.page.goto(`/assignments/${assignment}`);
    await expect(
      teamCard(wenPage.page).getByText("You are on no team, so you submit on your own."),
    ).toBeVisible();
    await expect(wenPage.page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
    await expect(wenPage.page.getByText(/^Submit for /)).toHaveCount(0);
  } finally {
    await Promise.all(opened.map((context) => context.close()));
  }
});

test("a grader grades a team's row once and every member reads the grade", async ({ browser }) => {
  test.setTimeout(240_000);
  const staff = await staffScene(browser);
  const opened: { close: () => Promise<void> }[] = [staff.context];
  try {
    const driftline = await staff.team("Driftline");
    const hana = await staff.person("Hana Mori");
    const oskar = await staff.person("Oskar Lindgren");
    await staff.enrol([
      [hana, driftline],
      [oskar, driftline],
    ]);
    const grader = await staff.grader("Iris Vance");
    const title = "Alpha release";
    const { assignment } = await staff.publish(title, "SECTION");
    await submitAs(browser, hana, assignment, "The alpha runs end to end.");

    const graderPage = await signedIn(browser, grader.username);
    opened.push(graderPage.context);
    const page = graderPage.page;
    await page.goto(`/staff/assignments/${assignment}?tab=submissions`);
    await expect(page.getByText("Team work and grades", { exact: true })).toBeVisible();
    await expect(page.getByText("Driftline", { exact: true })).toHaveCount(1);
    const row = submitterRow(page, "Driftline");
    await expect(row.getByText("Hana Mori, Oskar Lindgren", { exact: true })).toBeVisible();
    await expect(row.getByText("1 attempt", { exact: true })).toBeVisible();
    await expect(row.locator("summary").filter({ hasText: "Attempt #1" })).toContainText(
      "Hana Mori",
    );
    // One row, and one grader, for the team; none for its members.
    await expect(page.getByRole("combobox", { name: "Grader for Driftline" })).toHaveCount(1);
    await expect(page.getByRole("combobox", { name: "Grader for Hana Mori" })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Grader for Oskar Lindgren" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);

    await row.getByRole("button", { name: "Review assessments" }).click();
    await row.getByRole("button", { name: "Start assessment" }).click();
    await row.getByLabel("Score / 10").fill("8");
    await row.getByLabel("Overall feedback (optional)").fill("Works end to end.");
    await row.getByRole("button", { name: "Save draft" }).click();
    await expect(row.getByRole("button", { name: "Review release" })).toBeEnabled();
    await row.getByRole("button", { name: "Review release" }).click();
    await row.getByRole("button", { name: "Confirm release to learner" }).click();
    await expect(row.getByRole("button", { name: "Retract to correct" })).toBeVisible();
    await expect(row.getByText(RELEASED).first()).toBeVisible();
    await expect(row.getByText("8 / 10", { exact: true }).first()).toBeVisible();

    for (const member of [hana, oskar]) {
      const memberPage = await signedIn(browser, member.username);
      opened.push(memberPage.context);
      await memberPage.page.goto(`/assignments/${assignment}`);
      const card = teamCard(memberPage.page);
      await expect(card.getByText(RELEASED)).toBeVisible();
      await expect(card).toContainText("Grade 8 / 10");
      await memberPage.page.goto("/assignments");
      await expect(memberPage.page.getByRole("link").filter({ hasText: title })).toContainText(
        "Grade 8 / 10",
      );
    }
  } finally {
    await Promise.all(opened.map((context) => context.close()));
  }
});

test("staff move earlier submissions to teams and read what the move did", async ({ browser }) => {
  test.setTimeout(240_000);
  const staff = await staffScene(browser);
  const opened: { close: () => Promise<void> }[] = [staff.context];
  try {
    const paperboat = await staff.team("Paperboat");
    const halfmoon = await staff.team("Halfmoon");
    const nadia = await staff.person("Nadia Karim");
    const theo = await staff.person("Theo Brandt");
    const sunita = await staff.person("Sunita Rao");
    const aiko = await staff.person("Aiko Tanaka");
    const rafael = await staff.person("Rafael Mendes");
    await staff.enrol([
      [nadia, paperboat],
      [theo, paperboat],
      [sunita, paperboat],
      [aiko, halfmoon],
      [rafael, halfmoon],
    ]);
    const grader = await staff.grader("Pablo Reyes");
    const proposal = await staff.publish("Project proposal", "STUDENT");
    const nadiaWork = await submitAs(browser, nadia, proposal.assignment, "Nadia's.");
    const theoWork = await submitAs(browser, theo, proposal.assignment, "Theo's.");
    const aikoWork = await submitAs(browser, aiko, proposal.assignment, "Aiko's.");
    await staff.assess(proposal, nadia, nadiaWork, 7, true);
    await staff.assess(proposal, theo, theoWork, 9, false);
    await staff.assess(proposal, aiko, aikoWork, 6, true);
    await staff.post("/assignments/revise", {
      ...proposal.draft,
      assignment: proposal.assignment,
      submittedBy: "SECTION",
    });
    const path = `/staff/assignments/${proposal.assignment}?tab=submissions`;
    const moveButton = (page: Page) =>
      page.getByRole("button", { name: "Move earlier submissions to teams" });

    // A grader without course:manage sees what waits, and no move.
    const graderPage = await signedIn(browser, grader.username);
    opened.push(graderPage.context);
    await graderPage.page.goto(path);
    await expect(
      submitterRow(graderPage.page, "Paperboat").getByText("2 earlier submissions", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(moveButton(graderPage.page)).toHaveCount(0);

    // The manager reads the bar and each team's count, and moves.
    const page = staff.page;
    await page.goto(path);
    await expect(
      page.getByText(
        "3 submissions from 2 teams were handed in before this assignment changed to each team.",
      ),
    ).toBeVisible();
    const paperboatRow = submitterRow(page, "Paperboat");
    const halfmoonRow = submitterRow(page, "Halfmoon");
    await expect(paperboatRow.getByText("2 earlier submissions", { exact: true })).toBeVisible();
    await expect(halfmoonRow.getByText("1 earlier submission", { exact: true })).toBeVisible();
    await expect(paperboatRow.getByText("No submission yet", { exact: true })).toBeVisible();

    await moveButton(page).click();
    await expect(page.getByRole("status").filter({ hasText: "moved to" })).toHaveText(
      "3 submissions moved to 2 teams. 3 grades were copied as drafts.",
    );
    await expect(moveButton(page)).toHaveCount(0);

    await expect(paperboatRow.getByText("2 attempts", { exact: true })).toBeVisible();
    await expect(paperboatRow.getByText(/earlier submission/)).toHaveCount(0);
    const first = paperboatRow.locator("summary").filter({ hasText: "Attempt #1" });
    const second = paperboatRow.locator("summary").filter({ hasText: "Attempt #2" });
    await expect(first).toContainText("Nadia Karim");
    await expect(first).toContainText("Draft 7 / 10");
    await expect(second).toContainText("Theo Brandt");
    await expect(second).toContainText("Draft 9 / 10");
    await expect(paperboatRow.getByText(/^Draft grades differ/)).toHaveText(
      "Draft grades differ: 7 / 10 and 9 / 10",
    );
    const halfmoonAttempt = halfmoonRow.locator("summary").filter({ hasText: "Attempt #1" });
    await expect(halfmoonAttempt).toContainText("Aiko Tanaka");
    await expect(halfmoonAttempt).toContainText("Draft 6 / 10");
    await expect(halfmoonRow.getByText(/^Draft grades differ/)).toHaveCount(0);

    await page.getByRole("button", { name: "Release all drafts (3)" }).click();
    const release = page.getByRole("dialog", {
      name: "Release all complete assessment drafts for this assignment?",
    });
    await expect(release).toContainText(
      "3 drafts on 2 teams become visible to 5 students. Paperboat has draft grades that differ, and both would be released. Incomplete or concurrently changed drafts are skipped and reported.",
    );
    await release.getByRole("button", { name: "Cancel" }).click();
    await expect(release).toBeHidden();
  } finally {
    await Promise.all(opened.map((context) => context.close()));
  }
});
