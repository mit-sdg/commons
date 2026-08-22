import { createCommonsClient } from "../src/client.ts";
import { invitationCredential } from "../src/concepts/inviting/credential.ts";

export async function seedDemoData(_unusedDbUrl?: string, edgeOrigin = "http://127.0.0.1:4000") {
  try {
    let sessionCookie = "";

    const cookieFetch = (async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const res = await fetch(...args);
      const cookie = res.headers.get("set-cookie");
      if (cookie) {
        sessionCookie = cookie.split(";")[0] ?? "";
      }
      return res;
    }) as typeof fetch;

    const api = createCommonsClient({
      baseUrl: `${edgeOrigin}/api`,
      fetch: cookieFetch,
      headers: (): Record<string, string> =>
        sessionCookie !== "" ? { Cookie: sessionCookie } : {},
    });

    // 1. Log in as Mara (the bootstrapped administrator)
    const maraLogin = await api.auth.login({
      username: "mara",
      password: "password123",
    });

    if ("error" in maraLogin) {
      console.error(
        "[seed] Could not sign in as Mara Chen; skipping demo seeding:",
        maraLogin.error,
      );
      return;
    }

    const maraUser = maraLogin.user;

    // 2. Ensure Noah Patel exists
    let noahUser: string | undefined;
    const noahResolve = await api.auth.resolve({ username: "noah" });

    if (!("error" in noahResolve) && noahResolve.user) {
      noahUser = noahResolve.user;
    } else {
      const inviteNoah = await api.invitations.invite({ email: "noah@example.edu" });
      if (!("error" in inviteNoah) && inviteNoah.invitation) {
        const temporaryPassword = invitationCredential(inviteNoah.invitation);
        const registerNoah = await api.auth["accept-invitation"]({
          invitation: inviteNoah.invitation,
          temporaryPassword,
          username: "noah",
          password: "password123",
          displayName: "Noah Patel",
        });
        if (!("error" in registerNoah)) {
          noahUser = registerNoah.user;
        }
      }
    }

    // 3. Ensure Priya Sharma exists
    let priyaUser: string | undefined;
    const priyaResolve = await api.auth.resolve({ username: "priya" });

    if (!("error" in priyaResolve) && priyaResolve.user) {
      priyaUser = priyaResolve.user;
    } else {
      const invitePriya = await api.invitations.invite({ email: "priya@example.edu" });
      if (!("error" in invitePriya) && invitePriya.invitation) {
        const temporaryPassword = invitationCredential(invitePriya.invitation);
        const registerPriya = await api.auth["accept-invitation"]({
          invitation: invitePriya.invitation,
          temporaryPassword,
          username: "priya",
          password: "password123",
          displayName: "Priya Sharma",
        });
        if (!("error" in registerPriya)) {
          priyaUser = registerPriya.user;
        }
      }
    }

    // 4. Ensure demo collaborative task list exists
    const myLists = await api.tasklists.mine({});
    const existingList = !("error" in myLists)
      ? myLists.lists?.find((l) => l.title === "Course Launch Tasks")
      : undefined;

    if (!existingList) {
      const createList = await api.tasklists.create({ title: "Course Launch Tasks" });
      if (!("error" in createList) && createList.list) {
        const listId = createList.list;

        // Add Noah and Priya
        if (noahUser) {
          await api.tasklists["add-member"]({ list: listId, candidate: noahUser });
        }
        if (priyaUser) {
          await api.tasklists["add-member"]({ list: listId, candidate: priyaUser });
        }

        const now = new Date();
        const inTwoHours = new Date(now.getTime() + 2 * 3600_000);
        const inFiveHours = new Date(now.getTime() + 5 * 3600_000);
        const tomorrow = new Date(now.getTime() + 24 * 3600_000);
        const inTwoDays = new Date(now.getTime() + 48 * 3600_000);

        // Task 1: Mara (Active)
        const t1 = await api.tasks.create({
          list: listId,
          title: "Prepare Lecture 1 Slides",
          details:
            "### Checklist\n- [x] Title and course overview\n- [ ] Concept architecture diagrams\n- [ ] Live demo script\n\n> Note: Slides should be published to course page before 10 AM.",
          startsAt: now.toISOString(),
          endsAt: inTwoHours.toISOString(),
        });
        if (!("error" in t1) && t1.task && maraUser) {
          await api.tasks.assign({ task: t1.task, assignee: maraUser });
        }

        // Task 2: Noah (Active)
        const t2 = await api.tasks.create({
          list: listId,
          title: "Review Student Submissions",
          details:
            "Review incoming pull requests for Assignment 1.\n\nMake sure all unit tests and lint checks pass before grading.",
          startsAt: now.toISOString(),
          endsAt: inFiveHours.toISOString(),
        });
        if (!("error" in t2) && t2.task && noahUser) {
          await api.tasks.assign({ task: t2.task, assignee: noahUser });
        }

        // Task 3: Priya (Upcoming)
        const t3 = await api.tasks.create({
          list: listId,
          title: "Finalize Week 2 Reading List",
          details:
            "Select 3 required readings on distributed state and sync algorithms.\n\n1. Concept design and boundaries\n2. Reactive data synchronization\n3. Authorization policy models",
          startsAt: tomorrow.toISOString(),
          endsAt: inTwoDays.toISOString(),
        });
        if (!("error" in t3) && t3.task && priyaUser) {
          await api.tasks.assign({ task: t3.task, assignee: priyaUser });
        }
      }
    }

    console.log("[seed] Demo data seeded successfully via Commons HTTP client.");
  } catch (err) {
    console.error(`[seed] Note: Could not auto-seed demo data: ${err}`);
  }
}
