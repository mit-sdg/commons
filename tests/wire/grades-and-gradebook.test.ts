import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import type { CommonsWire } from "../../generated/wire.ts";
afterAll(stopTestDb);
const content = {
  name: "Argumentation",
  description: "Claims and evidence",
  deficient: "No claim",
  emergent: "Partial support",
  competent: "Connected support",
  expert: "Weighs alternatives",
  referenceUrl: "",
};
async function setup() {
  const app = assembleCommons(mongoImplementations(await testDb()));
  async function call<P extends keyof CommonsWire>(path: P, body: CommonsWire[P]["input"]) {
    const r = await app.invoker.invoke(path, body as never);
    return (
      r.ok ? r.value : { error: r.error.kind === "domain" ? r.error.value : r.error.code }
    ) as CommonsWire[P]["output"];
  }
  async function actor(username: string, student = false) {
    const u = await app.concepts.Authenticating.register({
      username,
      password: "password123",
      email: username + "@example.edu",
    });
    await app.concepts.Profiling.createProfile({ user: u.user, displayName: username });
    if (student) {
      const seats = await app.concepts.Rostering.importSeats({
        rows: [{ email: username + "@example.edu", kind: "STUDENT" }],
      });
      await app.concepts.Rostering.claimSeat({ seat: seats.created[0]._id, user: u.user });
    }
    const login = await call("/auth/login", { username, password: "password123" });
    if ("error" in login) throw new Error(String(login.error));
    return { user: u.user, session: login.session };
  }
  const staff = await actor("staff");
  const maya = await actor("maya", true);
  const noah = await actor("noah", true);
  const at = new Date();
  const draft = await app.concepts.Assigning.createDraft({
    author: staff.user,
    title: "Paper",
    instructions: "Explain your claim",
    kind: "HOMEWORK",
    availableAt: "2020-01-01T00:00:00Z",
    dueAt: "2090-01-01T00:00:00Z",
    closeAt: "2090-02-01T00:00:00Z",
    acceptsSubmissions: true,
    audience: "EVERYONE",
    targets: [],
    at,
  });
  await app.concepts.Assigning.publish({ ...draft, at });
  const standard = await call("/grades/define-standard", { session: staff.session, ...content });
  if ("error" in standard) throw new Error(String(standard.error));
  const criterion = await call("/grades/add-criterion", {
    session: staff.session,
    item: draft.assignment,
    basis: standard.edition,
    position: 0,
  });
  if ("error" in criterion) throw new Error(String(criterion.error));
  const sub = await call("/assignments/submit", {
    session: maya.session,
    assignment: draft.assignment,
    content: "The evidence supports this claim because…",
  });
  if ("error" in sub) throw new Error(String(sub.error));
  return {
    app,
    call,
    staff,
    maya,
    noah,
    item: draft.assignment,
    standard,
    criterion: criterion.criterion,
    evidence: sub.submission,
  };
}
test("released assessments retain standard editions, evidence, and correction history without cross-student disclosure", async () => {
  const { call, staff, maya, noah, item, standard, criterion, evidence } = await setup();
  const started = await call("/grades/record", {
    session: staff.session,
    learner: maya.user,
    item,
    evidence,
  });
  if ("error" in started) throw new Error(String(started.error));
  expect(await call("/grades/for-me", { session: maya.session })).toEqual({ grades: [] });
  expect(await call("/grades/detail", { session: noah.session, grade: started.grade })).toEqual({
    error: "NOT_FOUND",
  });
  expect(
    await call("/grades/record", { session: staff.session, learner: noah.user, item, evidence }),
  ).toEqual({ error: "NOT_FOUND" });
  expect(
    await call("/grades/save", {
      session: maya.session,
      ...started,
      feedback: "Private",
      judgments: [],
    }),
  ).toEqual({ error: "FORBIDDEN" });
  const saved = await call("/grades/save", {
    session: staff.session,
    ...started,
    judgments: [{ criterion, rating: "EMERGENT", feedback: "Connect the evidence." }],
    feedback: "Try again.",
  });
  if ("error" in saved) throw new Error(String(saved.error));
  const released = await call("/grades/release", { session: staff.session, ...saved });
  if ("error" in released) throw new Error(String(released.error));
  await call("/grades/revise-standard", {
    session: staff.session,
    ...content,
    standard: standard.standard,
    expectedEdition: standard.edition,
    emergent: "Changed meaning",
  });
  await call("/grades/remove-criterion", { session: staff.session, criterion });
  const visible = await call("/grades/for-me", { session: maya.session });
  if ("error" in visible) throw new Error(String(visible.error));
  expect(visible.grades).toHaveLength(1);
  expect(visible.grades[0]).toMatchObject({
    evidence,
    attempt: 1,
    judgments: [{ criterion, rating: "EMERGENT", feedback: "Connect the evidence." }],
  });
  expect(visible.grades[0].criteria[0].emergent).toBe(content.emergent);
  expect(visible.grades[0]).not.toHaveProperty("score");
  const retracted = await call("/grades/retract", { session: staff.session, ...released });
  if ("error" in retracted) throw new Error(String(retracted.error));
  expect(await call("/grades/for-me", { session: maya.session })).toEqual({ grades: [] });
  expect(await call("/grades/detail", { session: maya.session, grade: released.grade })).toEqual({
    error: "NOT_FOUND",
  });
  const corrected = await call("/grades/save", {
    session: staff.session,
    ...retracted,
    judgments: [{ criterion, rating: "COMPETENT", feedback: "Correction" }],
    feedback: "Corrected",
  });
  if ("error" in corrected) throw new Error(String(corrected.error));
  await call("/grades/release", { session: staff.session, ...corrected });
  const after = await call("/grades/for-me", { session: maya.session });
  if ("error" in after) throw new Error(String(after.error));
  expect(after.grades).toHaveLength(1);
  expect(after.grades[0].history).toHaveLength(2);
  expect(after.grades[0].history[0].judgments[0].rating).toBe("EMERGENT");
  expect(await call("/grades/for-me", { session: noah.session })).toEqual({ grades: [] });
  expect(await call("/grades/gradebook", { session: noah.session })).toEqual({
    error: "FORBIDDEN",
  });
  expect(await call("/grades/standards", { session: maya.session })).toEqual({
    error: "FORBIDDEN",
  });
});
test("submission policy refuses unknown, early, closed, nonaccepting and narrowed assignments before creating artifacts", async () => {
  const { app, call, staff, maya, item } = await setup();
  const original = (await app.concepts.Assigning._getDetail({ assignment: item }))[0].detail;
  const {
    author: _author,
    createdAt: _created,
    updatedAt: _updated,
    status: _status,
    ...revision
  } = original;
  for (const changes of [
    { availableAt: "2089-01-01T00:00:00Z" },
    { closeAt: "2021-01-01T00:00:00Z", dueAt: "2020-12-01T00:00:00Z" },
    { acceptsSubmissions: false },
    { audience: "TARGETS", targets: ["other-section"] },
  ]) {
    await app.concepts.Assigning.revise({
      ...revision,
      closeAt: revision.closeAt ?? "2090-02-01T00:00:00Z",
      ...changes,
      audience: changes.audience === "TARGETS" ? "TARGETS" : revision.audience,
      at: new Date(),
    });
    expect(
      await call("/assignments/submit", {
        session: maya.session,
        assignment: item,
        content: "Must be refused",
      }),
    ).toEqual({ error: "NOT_FOUND" });
  }
  expect(
    await call("/assignments/submit", {
      session: maya.session,
      assignment: "missing",
      content: "No",
    }),
  ).toEqual({ error: "NOT_FOUND" });
  const list = await call("/submissions/for-assignment", {
    session: staff.session,
    assignment: item,
  });
  if ("error" in list) throw new Error(String(list.error));
  expect(list.submissions).toHaveLength(1);
});
