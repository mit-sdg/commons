import { describe, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { theStaffDashboardCounts } from "../../src/composition/course/calendar.ts";

async function actor(
  app: ReturnType<typeof assembleCommons>,
  username: string,
  email = `${username}@example.edu`,
) {
  const registered = await app.invoker.invoke("/auth/register", {
    username,
    password: "password123",
    displayName: username,
    email,
  } as never);
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!registered.ok || !login.ok) throw new Error(`could not create ${username}`);
  return {
    user: (registered.value as { user: string }).user,
    session: (login.value as { session: string }).session,
  };
}

describe("course staff composition", () => {
  test("every claimed staff seat grants the course-staff role", async () => {
    const app = assembleCommons();
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [
        { externalKey: "staff-1", email: "one@example.edu", rosterName: "One", kind: "STAFF" },
        { externalKey: "staff-2", email: "two@example.edu", rosterName: "Two", kind: "STAFF" },
      ],
    });
    expect(created).toHaveLength(2);

    for (const number of [1, 2]) {
      const staff = await actor(
        app,
        `staff_${number}`,
        `${number === 1 ? "one" : "two"}@example.edu`,
      );
      const claim = await app.invoker.invoke("/roster/claim-seat", {
        session: staff.session,
        externalKey: `staff-${number}`,
      } as never);
      expect(claim.ok).toBe(true);
      expect(
        await app.concepts.Roling._holdsRoleNamed({
          user: staff.user,
          context: "forum",
          name: "course-staff",
        }),
      ).toEqual({ held: true });
    }
  });

  test("a custom roster role does not suppress the course-staff grant", async () => {
    const app = assembleCommons();
    const staff = await actor(app, "custom_staff", "custom@example.edu");
    const { role } = await app.concepts.Roling.defineRole({
      name: "roster-helper",
      capabilities: ["roster:manage"],
    });
    await app.concepts.Roling.grant({ user: staff.user, context: "forum", role });
    await app.concepts.Rostering.importSeats({
      rows: [
        {
          externalKey: "custom-staff",
          email: "custom@example.edu",
          rosterName: "Course Staff",
          kind: "STAFF",
        },
      ],
    });

    const claim = await app.invoker.invoke("/roster/claim-seat", {
      session: staff.session,
      externalKey: "custom-staff",
    } as never);
    expect(claim.ok).toBe(true);
    expect(
      await app.concepts.Roling._holdsRoleNamed({
        user: staff.user,
        context: "forum",
        name: "course-staff",
      }),
    ).toEqual({ held: true });
  });

  test("the staff dashboard counts active course work", async () => {
    const app = assembleCommons();
    const at = new Date("2026-07-19T12:00:00.000Z");
    const { assignment } = await app.concepts.Assigning.createDraft({
      author: "staff",
      title: "Design exercise",
      instructions: "Make the behavior legible.",
      kind: "HOMEWORK",
      availableAt: "2026-07-19T12:00:00.000Z",
      dueAt: "2026-07-20T12:00:00.000Z",
      closeAt: "2026-07-21T12:00:00.000Z",
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
      at,
    });
    await app.concepts.Itemizing.configureItem({
      item: assignment,
      label: "Design exercise",
      maxPoints: 100,
    });
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [
        {
          externalKey: "student-1",
          email: "student@example.edu",
          rosterName: "Student One",
          kind: "STUDENT",
        },
      ],
    });
    await app.concepts.Rostering.claimSeat({ seat: created[0]._id, user: "learner" });
    await app.concepts.Banking.setTerms({ allowance: 2, perItemLimit: 5, unitHours: 24 });
    await app.concepts.Banking.apply({ learner: "learner", item: assignment, days: 1, at });

    expect(await app.form(theStaffDashboardCounts({}))).toEqual({
      assignments: 1,
      gradeItems: 1,
      lateDayUses: 1,
    });
  });
});
