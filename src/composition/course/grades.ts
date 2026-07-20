import { activeUser } from "../access/session.ts";
import {
  each,
  form,
  former,
  is,
  no,
  reaction,
  request,
  whether,
  when,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageGrades,
  mayNotManageGrades,
  mayNotViewAllGrades,
  mayViewAllGrades,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Assigning, Grading, Itemizing, Rostering, Timing } = concepts;

/** Which released grades belong to this learner? */
export const theReleasedGradesOf = former(
  "the released grades of (learner)",
  ({ learner, item, grade, score, outOf, status, feedback, label }) =>
    each(
      Grading._getGradesForLearner({ learner }).is({ item, grade, score, outOf, status, feedback }),
    )
      .where(
        whether(Itemizing._getItem({ item }).is({ label })),
        is.among(status, ["RELEASED", "EXCUSED"]),
      )
      .form({ item, grade, score, maxPoints: outOf, status, feedback, label }),
);
/** Which grades belong to this learner? */
export const theGradesOf = former(
  "the grades of (learner)",
  ({ learner, item, grade, score, outOf, status, feedback, label }) =>
    each(
      Grading._getGradesForLearner({ learner }).is({ item, grade, score, outOf, status, feedback }),
    )
      .where(whether(Itemizing._getItem({ item }).is({ label })))
      .form({ item, grade, score, maxPoints: outOf, status, feedback, label }),
);

/** Which grades are on this item? */
export const theGradesOn = former(
  "the grades on (item)",
  ({ item, learner, grade, score, status }) =>
    each(Grading._getGradesForItem({ item }).is({ learner, grade, score, status })).form({
      learner,
      grade,
      score,
      status,
    }),
);
/** Which learners belong in the gradebook? */
export const theGradebookLearners = former(
  "the gradebook learners ()",
  ({ user, seat, section, rosterName, email }) =>
    each(Rostering._getActiveStudents({}).is({ user, seat, section, rosterName, email })).form({
      user,
      seat,
      section,
      rosterName,
      email,
    }),
);
/** What is the course gradebook? */
export const theGradebook = former("the gradebook ()", (vars) => {
  const {
    item,
    label,
    maxPoints,
    user,
    section,
    rosterName,
    email,
    cellItem,
    grade,
    score,
    status,
  } = vars;
  return form({
    items: each(Itemizing._getItems({}).is({ item, label, maxPoints })).form({
      item,
      label,
      maxPoints,
    }),
    learners: each(Rostering._getActiveStudents({}).is({ user, section, rosterName, email }))
      .arranged(rosterName, "ascending")
      .form({
        learner: user,
        rosterName,
        email,
        section,
        cells: each(Itemizing._getItems({}).is({ item: cellItem }))
          .where(
            whether(
              Grading._getGrade({ learner: user, item: cellItem }).is({
                grade,
                score,
                status,
              }),
            ),
          )
          .form({ item: cellItem, grade, score, status }),
      }),
  });
});
export const RevisedAcceptingAssignmentEnsuresGradeItem = reaction(({ assignment, title }) =>
  when(
    Assigning.revise,
    { title },
    { assignment, status: "PUBLISHED", acceptsSubmissions: true },
  ).then(request(Itemizing.ensureItem, { item: assignment, label: title, maxPoints: 100 })),
);
export const RemovedCriterionClearsScores = reaction(({ criterion }) =>
  when(Itemizing.removeCriterion, {}, { criterion }).then(
    request(Grading.clearCriterionScores, { criterion }),
  ),
);

export const GradesConfigureItem = endpoint(
  "/grades/configure-item",
  ({ session, item, label, maxPoints, user, gradeItem }) =>
    receive({ session, item, label, maxPoints })
      .where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
      .then(
        request(Itemizing.configureItem, { item, label, maxPoints }, { gradeItem }),
        respond({ gradeItem }),
      ),
);

export const GradesConfigureItemForbidden = endpoint(
  "/grades/configure-item",
  ({ session, item, label, maxPoints, user }) =>
    receive({ session, item, label, maxPoints })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesAddCriterion = endpoint(
  "/grades/add-criterion",
  ({ session, item, name, maxPoints, position, user, criterion }) =>
    receive({ session, item, name, maxPoints, position })
      .where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
      .then(
        request(Itemizing.addCriterion, { item, name, maxPoints, position }, { criterion }),
        respond({ criterion }),
      ),
);

export const GradesAddCriterionForbidden = endpoint(
  "/grades/add-criterion",
  ({ session, item, name, maxPoints, position, user }) =>
    receive({ session, item, name, maxPoints, position })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesReviseCriterion = endpoint(
  "/grades/revise-criterion",
  ({ session, criterion, name, maxPoints, position, user, revised }) =>
    receive({ session, criterion, name, maxPoints, position })
      .where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
      .then(
        request(
          Itemizing.reviseCriterion,
          { criterion, name, maxPoints, position },
          { criterion: revised },
        ),
        respond({ criterion: revised }),
      ),
);

export const GradesReviseCriterionForbidden = endpoint(
  "/grades/revise-criterion",
  ({ session, criterion, name, maxPoints, position, user }) =>
    receive({ session, criterion, name, maxPoints, position })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesRemoveCriterion = endpoint(
  "/grades/remove-criterion",
  ({ session, criterion, user, removed }) =>
    receive({ session, criterion })
      .where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
      .then(
        request(Itemizing.removeCriterion, { criterion }, { criterion: removed }),
        respond({ criterion: removed }),
      ),
);

export const GradesRemoveCriterionForbidden = endpoint(
  "/grades/remove-criterion",
  ({ session, criterion, user }) =>
    receive({ session, criterion })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const GradesRecord = endpoint(
  "/grades/record",
  ({ session, learner, item, evidence, score, feedback, user, maxPoints, at, grade }) =>
    receive({ session, learner, item, evidence, score, feedback })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getItem({ item }).is({ maxPoints }),
      )
      .then(
        request(
          Grading.record,
          { learner, item, evidence, grader: user, score, outOf: maxPoints, feedback, at },
          { grade },
        ),
        respond({ grade }),
      ),
  {
    input: {
      required: ["session", "learner", "item", "score", "feedback"],
      defaults: { evidence: null },
    },
  },
);

export const GradesRecordForbidden = endpoint(
  "/grades/record",
  ({ session, learner, item, evidence, score, feedback, user }) =>
    receive({ session, learner, item, evidence, score, feedback })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const GradesRecordMissingItem = endpoint(
  "/grades/record",
  ({ session, learner, item, evidence, score, feedback, user }) =>
    receive({ session, learner, item, evidence, score, feedback })
      .where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        no(Itemizing._getItem({ item })),
      )
      .then(respond({ error: "GRADE_ITEM_NOT_FOUND" })),
);

export const GradesScoreCriterion = endpoint(
  "/grades/score-criterion",
  ({ session, learner, item, criterion, points, feedback, user, critMax, criterionScore }) =>
    receive({ session, learner, item, criterion, points, feedback })
      .where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getCriterion({ criterion }).is({ item, maxPoints: critMax }),
      )
      .then(
        request(
          Grading.scoreCriterion,
          { learner, item, criterion, points, outOf: critMax, feedback },
          { criterionScore },
        ),
        respond({ criterionScore }),
      ),
);

export const GradesScoreCriterionForbidden = endpoint(
  "/grades/score-criterion",
  ({ session, learner, item, criterion, points, feedback, user }) =>
    receive({ session, learner, item, criterion, points, feedback })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesScoreCriterionMissing = endpoint(
  "/grades/score-criterion",
  ({ session, learner, item, criterion, points, feedback, user }) =>
    receive({ session, learner, item, criterion, points, feedback })
      .where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        no(Itemizing._getCriterion({ criterion })),
      )
      .then(respond({ error: "CRITERION_NOT_FOUND" })),
);
export const GradesScoreCriterionCrossItem = endpoint(
  "/grades/score-criterion",
  ({ session, learner, item, criterion, points, feedback, user }) =>
    receive({ session, learner, item, criterion, points, feedback })
      .where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getCriterion({ criterion }).is.not({ item }),
      )
      .then(respond({ error: "CRITERION_NOT_FOUND" })),
);

export const GradesRelease = endpoint(
  "/grades/release",
  ({ session, learner, item, user, at, grade }) =>
    receive({ session, learner, item })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
      .then(request(Grading.release, { learner, item, at }, { grade }), respond({ grade })),
);

export const GradesReleaseForbidden = endpoint(
  "/grades/release",
  ({ session, learner, item, user }) =>
    receive({ session, learner, item })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesReleaseItem = endpoint(
  "/grades/release-item",
  ({ session, item, user, at, released }) =>
    receive({ session, item })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
      .then(request(Grading.releaseItem, { item, at }, { released }), respond({ released })),
);

export const GradesReleaseItemForbidden = endpoint(
  "/grades/release-item",
  ({ session, item, user }) =>
    receive({ session, item })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesRetract = endpoint(
  "/grades/retract",
  ({ session, learner, item, user, at, grade }) =>
    receive({ session, learner, item })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
      .then(request(Grading.retract, { learner, item, at }, { grade }), respond({ grade })),
);

export const GradesRetractForbidden = endpoint(
  "/grades/retract",
  ({ session, learner, item, user }) =>
    receive({ session, learner, item })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesExcuse = endpoint(
  "/grades/excuse",
  ({ session, learner, item, feedback, user, at, grade }) =>
    receive({ session, learner, item, feedback })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
      .then(
        request(Grading.excuse, { learner, item, grader: user, feedback, at }, { grade }),
        respond({ grade }),
      ),
);

export const GradesExcuseForbidden = endpoint(
  "/grades/excuse",
  ({ session, learner, item, feedback, user }) =>
    receive({ session, learner, item, feedback })
      .where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesForMe = endpoint("/grades/for-me", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
    .then(respond({ grades: theReleasedGradesOf(user) })),
);

export const GradesForMeNotStudent = endpoint("/grades/for-me", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const GradesForStudent = endpoint("/grades/for-student", ({ session, learner, user }) =>
  receive({ session, learner })
    .where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
    .then(respond({ grades: theGradesOf(learner) })),
);

export const GradesForStudentForbidden = endpoint(
  "/grades/for-student",
  ({ session, learner, user }) =>
    receive({ session, learner })
      .where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const GradesForItem = endpoint("/grades/for-item", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
    .then(respond({ grades: theGradesOn(item) })),
);

export const GradesForItemForbidden = endpoint("/grades/for-item", ({ session, item, user }) =>
  receive({ session, item })
    .where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const GradesGradebook = endpoint("/grades/gradebook", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
    .then(respond({ learners: theGradebookLearners() })),
);

export const GradesGradebookForbidden = endpoint("/grades/gradebook", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const GradesExport = endpoint("/grades/export", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
    .then(respond({ csv: "" })),
);

export const GradesExportForbidden = endpoint("/grades/export", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
