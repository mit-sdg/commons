export async function seedDemoData(mongodbUrl: string, edgeOrigin: string) {
  try {
    const v8 = await import("node:v8");
    v8.startupSnapshot.isBuildingSnapshot = () => false;
    const { MongoClient } = await import("mongodb");

    const client = new MongoClient(mongodbUrl);
    await client.connect();
    const db = client.db();
    const userCount = await db.collection("concept_authenticating_users").countDocuments();
    await client.close();

    if (userCount > 0) return;

    // Seed 3 demo accounts
    const accounts = [
      { username: "mara", displayName: "Mara Chen", email: "mara@example.edu" },
      { username: "noah", displayName: "Noah Patel", email: "noah@example.edu" },
      { username: "priya", displayName: "Priya Sharma", email: "priya@example.edu" },
    ];

    const userIds: Record<string, string> = {};
    const sessions: Record<string, string> = {};

    const clientConnect = new MongoClient(mongodbUrl);
    await clientConnect.connect();
    const directDb = clientConnect.db();

    // Insert direct concept state
    for (const { username, displayName, email } of accounts) {
      const registerRes = await fetch(`${edgeOrigin}/api/auth/register-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupSecret: "",
          username,
          password: "password123",
          displayName,
          email,
        }),
      }).catch(() => null);

      if (!registerRes || !registerRes.ok) {
        // Direct seed via mongo
        const user = crypto.randomUUID();
        const hashedPassword = await Bun.password.hash("password123");
        await directDb.collection("concept_authenticating_users").insertOne({
          _id: user,
          username,
          passwordHash: hashedPassword,
          email,
          createdAt: new Date(),
        });
        await directDb.collection("concept_profiling_profiles").insertOne({
          _id: crypto.randomUUID(),
          user,
          displayName,
          bio: `Demo account for ${displayName}`,
          avatar: "",
          email,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        userIds[username] = user;
      }
    }
    await clientConnect.close();

    // Log in as mara
    const loginRes = await fetch(`${edgeOrigin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "mara", password: "password123" }),
    });

    if (loginRes.ok) {
      const loginData = (await loginRes.json()) as { session: string };
      sessions.mara = loginData.session;

      // Log in noah & priya to get their user IDs
      const noahLogin = await fetch(`${edgeOrigin}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "noah", password: "password123" }),
      });
      if (noahLogin.ok) {
        const d = (await noahLogin.json()) as { session: string; user?: string };
        sessions.noah = d.session;
      }

      const priyaLogin = await fetch(`${edgeOrigin}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "priya", password: "password123" }),
      });
      if (priyaLogin.ok) {
        const d = (await priyaLogin.json()) as { session: string; user?: string };
        sessions.priya = d.session;
      }

      // Create a demo collaborative task list
      const createListRes = await fetch(`${edgeOrigin}/api/tasklists/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: sessions.mara, title: "Course Launch Tasks" }),
      });

      if (createListRes.ok) {
        const { list } = (await createListRes.json()) as { list: string };

        // Add Noah and Priya
        if (userIds.noah) {
          await fetch(`${edgeOrigin}/api/tasklists/add-member`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessions.mara, list, candidate: userIds.noah }),
          });
        }
        if (userIds.priya) {
          await fetch(`${edgeOrigin}/api/tasklists/add-member`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessions.mara, list, candidate: userIds.priya }),
          });
        }

        const now = new Date();
        const inTwoHours = new Date(now.getTime() + 2 * 3600_000);
        const inFiveHours = new Date(now.getTime() + 5 * 3600_000);
        const tomorrow = new Date(now.getTime() + 24 * 3600_000);
        const inTwoDays = new Date(now.getTime() + 48 * 3600_000);

        // Create initial tasks
        const t1 = await fetch(`${edgeOrigin}/api/tasks/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: sessions.mara,
            list,
            title: "Prepare Lecture 1 Slides",
            details:
              "### Checklist\n- [x] Title and course overview\n- [ ] Concept architecture diagrams\n- [ ] Live demo script\n\n> Note: Slides should be published to course page before 10 AM.",
            startsAt: now.toISOString(),
            endsAt: inTwoHours.toISOString(),
          }),
        });
        if (t1.ok && userIds.mara) {
          const { task } = (await t1.json()) as { task: string };
          await fetch(`${edgeOrigin}/api/tasks/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessions.mara, task, assignee: userIds.mara }),
          });
        }

        const t2 = await fetch(`${edgeOrigin}/api/tasks/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: sessions.mara,
            list,
            title: "Review Student Submissions",
            details:
              "Review incoming pull requests for Assignment 1.\n\nMake sure all unit tests and lint checks pass before grading.",
            startsAt: now.toISOString(),
            endsAt: inFiveHours.toISOString(),
          }),
        });
        if (t2.ok && userIds.noah) {
          const { task } = (await t2.json()) as { task: string };
          await fetch(`${edgeOrigin}/api/tasks/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessions.mara, task, assignee: userIds.noah }),
          });
        }

        const t3 = await fetch(`${edgeOrigin}/api/tasks/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: sessions.mara,
            list,
            title: "Finalize Week 2 Reading List",
            details:
              "Select 3 required readings on distributed state and sync algorithms.\n\n1. Concept design and boundaries\n2. Reactive data synchronization\n3. Authorization policy models",
            startsAt: tomorrow.toISOString(),
            endsAt: inTwoDays.toISOString(),
          }),
        });
        if (t3.ok && userIds.priya) {
          const { task } = (await t3.json()) as { task: string };
          await fetch(`${edgeOrigin}/api/tasks/assign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session: sessions.mara, task, assignee: userIds.priya }),
          });
        }
      }
    }
  } catch (err) {
    console.error(`[seed] Note: Could not auto-seed demo data: ${err}`);
  }
}
