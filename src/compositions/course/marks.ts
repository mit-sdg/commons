import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { is, no, now, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { isActiveStudent, isNotActiveStudent, mayGrade, mayNotGrade } from "../access/policy.ts";
import { activeUser } from "../access/session.ts";
import { theMarksOf, theMarksOn, theReleasedMarksOf } from "./grades.ts";

const { Assigning, Grading, Itemizing, Submitting } = concepts;

export const mayMarkWork = view(
  "(learner) may receive a point grade on (item) using (evidence)",
  ({ learner, item, evidence }, _outputs, _bindings) =>
    where(
      isActiveStudent({ user: learner }),
      Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
      Grading._getConfiguration({ item }).is({ method: "POINTS" }),
      Assigning._getAssignments({}).is({
        assignment: item,
        status: "PUBLISHED",
        acceptsSubmissions: true,
      }),
      Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
      Submitting._getAttempts({ assignment: item, submitter: learner }).is({
        submission: evidence,
        status: "SUBMITTED",
      }),
    ),
).holds();

export const mayCorrectMark = view(
  "(learner) may correct an existing point grade on (item) using unchanged (evidence)",
  ({ learner, item, evidence }, _outputs, _bindings) =>
    where(Grading._getMarksForLearner({ learner }).is({ item, evidence }).is.not({ evidence: "" })),
).holds();

export const mayExcuseWork = view(
  "(learner) may be excused from point grading on (item) using (evidence)",
  ({ learner, item, evidence }, _outputs, _bindings) => [
    where(
      isActiveStudent({ user: learner }),
      Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
      Grading._getConfiguration({ item }).is({ method: "POINTS" }),
      Assigning._getAssignments({}).is({
        assignment: item,
        status: "PUBLISHED",
        acceptsSubmissions: true,
      }),
      Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
      is.among(evidence, [""]),
    ),
    where(mayMarkWork({ learner, item, evidence })),
  ],
).holds();

export const mayCorrectExcusal = view(
  "(mark) may be re-excused for (learner) on (item) using unchanged (evidence)",
  ({ mark, learner, item, evidence }, _outputs, _bindings) =>
    where(Grading._getMark({ mark }).is({ learner, item, evidence })),
).holds();

export const mayRecordMark = view(
  "(learner) may record a point grade on (item) using (evidence)",
  ({ learner, item, evidence }, _outputs, _bindings) => [
    where(mayMarkWork({ learner, item, evidence })),
    where(mayCorrectMark({ learner, item, evidence })),
  ],
).holds();

export const mayExcuseMark = view(
  "(mark) may be excused for (learner) on (item) using (evidence)",
  ({ mark, learner, item, evidence }, _outputs, _bindings) => [
    where(mayExcuseWork({ learner, item, evidence })),
    where(mayCorrectExcusal({ mark, learner, item, evidence })),
  ],
).holds();

export const MarksRecord = endpoint(
  "/marks/record",
  ({
    session,
    learner,
    item,
    evidence,
    score,
    feedback,
    generation,
    version,
    user,
    at,
    mark,
    savedVersion,
  }) =>
    receive({ session, learner, item, evidence, score, feedback, generation, version }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        mayRecordMark({ learner, item, evidence }),
      )
        .then(
          Grading.recordMark({
            learner,
            item,
            evidence,
            grader: user,
            score,
            feedback,
            generation,
            version,
            at,
          }).responds({ mark, version: savedVersion }),
        )
        .then(respond({ mark, version: savedVersion }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(mayRecordMark({ learner, item, evidence })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("invalid-evidence"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksRelease = endpoint(
  "/marks/release",
  ({ session, mark, version, user, at, saved, savedVersion }) =>
    receive({ session, mark, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          Grading.releaseMark({ mark, version, at }).responds({
            mark: saved,
            version: savedVersion,
          }),
        )
        .then(respond({ mark: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksRetract = endpoint(
  "/marks/retract",
  ({ session, mark, version, user, at, saved, savedVersion }) =>
    receive({ session, mark, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          Grading.retractMark({ mark, version, at }).responds({
            mark: saved,
            version: savedVersion,
          }),
        )
        .then(respond({ mark: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksRestoreExcused = endpoint(
  "/marks/restore-excused",
  ({ session, mark, version, user, at, saved, savedVersion }) =>
    receive({ session, mark, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          Grading.restoreExcusedMark({ mark, version, at }).responds({
            mark: saved,
            version: savedVersion,
          }),
        )
        .then(respond({ mark: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksExcuse = endpoint(
  "/marks/excuse",
  ({
    session,
    learner,
    item,
    evidence,
    feedback,
    generation,
    mark,
    version,
    user,
    at,
    saved,
    savedVersion,
  }) =>
    receive({ session, learner, item, evidence, feedback, generation, mark, version }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        mayExcuseMark({ mark, learner, item, evidence }),
      )
        .then(
          Grading.excuseMark({
            learner,
            item,
            evidence,
            grader: user,
            feedback,
            generation,
            mark,
            version,
            at,
          }).responds({ mark: saved, version: savedVersion }),
        )
        .then(respond({ mark: saved, version: savedVersion }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(mayExcuseMark({ mark, learner, item, evidence })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("invalid-evidence"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksReleaseItem = endpoint(
  "/marks/release-item",
  ({ session, item, generation, user, at, released, skipped, unconfirmed }) =>
    receive({ session, item, generation }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          Grading.releaseMarks({ item, generation, at }).responds({
            released,
            skipped,
            unconfirmed,
          }),
        )
        .then(respond({ released, skipped, unconfirmed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const MarksForItem = endpoint("/marks/for-item", ({ session, item, user }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ marks: theMarksOn({ item }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const MarksForStudent = endpoint("/marks/for-student", ({ session, learner, user }) =>
  receive({ session, learner }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ marks: theMarksOf({ learner }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const MarksForMe = endpoint("/marks/for-me", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ marks: theReleasedMarksOf({ learner: user }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("not-student"),
  ),
);
