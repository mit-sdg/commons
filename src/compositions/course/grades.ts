import { activeUser } from "../access/session.ts";
import {
  each,
  form,
  former,
  is,
  no,
  reaction,
  whether,
  when,
  where,
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
import { concepts } from "../../vocabulary.ts";

const { Grading, Itemizing, Rostering, Timing } = concepts;

/** Which released grades belong to this learner? */
export const theReleasedGradesOf = former(
  "the released grades of (learner)",
  ({ learner }, { item, grade, score, outOf, status, feedback, label }) =>
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
  ({ learner }, { item, grade, score, outOf, status, feedback, label }) =>
    each(
      Grading._getGradesForLearner({ learner }).is({ item, grade, score, outOf, status, feedback }),
    )
      .where(whether(Itemizing._getItem({ item }).is({ label })))
      .form({ item, grade, score, maxPoints: outOf, status, feedback, label }),
);

/** Which criteria assess this item? */
export const theCriteriaOf = former(
  "the criteria of (item)",
  ({ item }, { criterion, name, maxPoints, position }) =>
    each(Itemizing._getCriteria({ item }).is({ criterion, name, maxPoints, position })).form({
      criterion,
      name,
      maxPoints,
      position,
    }),
);
/** Which criterion scores belong to this learner's grade? */
export const theCriterionScoresOf = former(
  "the criterion scores of (learner) on (item)",
  ({ learner, item }, { criterion, points, maxPoints, feedback }) =>
    each(
      Grading._getCriterionScores({ learner, item }).is({
        criterion,
        points,
        feedback,
      }),
    )
      .where(Itemizing._getCriterion({ criterion }).is({ maxPoints }))
      .form({ criterion, points, maxPoints, feedback }),
);
/** Which grades are on this item? */
export const theGradesOn = former(
  "the grades on (item)",
  ({ item }, { learner, grade, score, status }) =>
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
  (_inputs, { user, seat, section, rosterName, email }) =>
    each(Rostering._getActiveStudents({}).is({ user, seat, section, rosterName, email })).form({
      user,
      seat,
      section,
      rosterName,
      email,
    }),
);
/** What is the course gradebook? */
export const theGradebook = former(
  "the gradebook ()",
  (
    _inputs,
    { item, label, maxPoints, user, section, rosterName, email, cellItem, grade, score, status },
  ) =>
    form({
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
    }),
);
export const RemovedCriterionClearsScores = reaction(({ criterion }) =>
  when(Itemizing.removeCriterion({}).responds({ criterion })).then(
    Grading.clearCriterionScores({ criterion }),
  ),
);

export const GradesConfigureItem = endpoint(
  "/grades/configure-item",
  ({ session, item, label, maxPoints, user, gradeItem }) =>
    receive({ session, item, label, maxPoints }).then(
      where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
        .then(Itemizing.configureItem({ item, label, maxPoints }).responds({ gradeItem }))
        .then(respond({ gradeItem }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesItem = endpoint(
  "/grades/item",
  ({ session, item, user, label, maxPoints, status }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayViewAllGrades({ user }),
        Itemizing._getItem({ item }).is({ label, maxPoints, status }),
      )
        .then(
          respond({
            item,
            label,
            maxPoints,
            status,
            criteria: theCriteriaOf({ item }),
          }),
        )
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayViewAllGrades({ user }),
        no(Itemizing._getItem({ item })),
      )
        .then(respond({ error: "GRADE_ITEM_NOT_FOUND" }))
        .named("missing"),
    ),
);

export const GradesAddCriterion = endpoint(
  "/grades/add-criterion",
  ({ session, item, name, maxPoints, position, user, criterion }) =>
    receive({ session, item, name, maxPoints, position }).then(
      where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
        .then(Itemizing.addCriterion({ item, name, maxPoints, position }).responds({ criterion }))
        .then(respond({ criterion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesReviseCriterion = endpoint(
  "/grades/revise-criterion",
  ({ session, criterion, name, maxPoints, position, user, revised }) =>
    receive({ session, criterion, name, maxPoints, position }).then(
      where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
        .then(
          Itemizing.reviseCriterion({ criterion, name, maxPoints, position }).responds({
            criterion: revised,
          }),
        )
        .then(respond({ criterion: revised }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRemoveCriterion = endpoint(
  "/grades/remove-criterion",
  ({ session, criterion, user, removed }) =>
    receive({ session, criterion }).then(
      where(activeUser({ session }).is({ user }), mayManageGrades({ user }))
        .then(Itemizing.removeCriterion({ criterion }).responds({ criterion: removed }))
        .then(respond({ criterion: removed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesCriterionScores = endpoint(
  "/grades/criterion-scores",
  ({ session, learner, item, user }) =>
    receive({ session, learner, item }).then(
      where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
        .then(
          respond({
            scores: theCriterionScoresOf({ learner, item }),
          }),
        )
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRecord = endpoint(
  "/grades/record",
  ({ session, learner, item, evidence, score, feedback, user, maxPoints, at, grade }) =>
    receive({ session, learner, item, evidence, score, feedback }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getItem({ item }).is({ maxPoints }),
      )
        .then(
          Grading.record({
            learner,
            item,
            evidence,
            grader: user,
            score,
            outOf: maxPoints,
            feedback,
            at,
          }).responds({ grade }),
        )
        .then(respond({ grade }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        no(Itemizing._getItem({ item })),
      )
        .then(respond({ error: "GRADE_ITEM_NOT_FOUND" }))
        .named("missing-item"),
    ),
  {
    input: {
      required: ["session", "learner", "item", "score", "feedback"],
      defaults: { evidence: null },
    },
  },
);

export const GradesScoreCriterion = endpoint(
  "/grades/score-criterion",
  ({ session, learner, item, criterion, points, feedback, user, critMax, criterionScore }) =>
    receive({ session, learner, item, criterion, points, feedback }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getCriterion({ criterion }).is({ item, maxPoints: critMax }),
      )
        .then(
          Grading.scoreCriterion({
            learner,
            item,
            criterion,
            points,
            outOf: critMax,
            feedback,
          }).responds({ criterionScore }),
        )
        .then(respond({ criterionScore }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
      where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        no(Itemizing._getCriterion({ criterion })),
      )
        .then(respond({ error: "CRITERION_NOT_FOUND" }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
        Itemizing._getCriterion({ criterion }).is.not({ item }),
      )
        .then(respond({ error: "CRITERION_NOT_FOUND" }))
        .named("cross-item"),
    ),
);

export const GradesRelease = endpoint(
  "/grades/release",
  ({ session, learner, item, user, at, grade }) =>
    receive({ session, learner, item }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
        .then(Grading.release({ learner, item, at }).responds({ grade }))
        .then(respond({ grade }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesReleaseItem = endpoint(
  "/grades/release-item",
  ({ session, item, user, at, released }) =>
    receive({ session, item }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
        .then(Grading.releaseItem({ item, at }).responds({ released }))
        .then(respond({ released }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRetract = endpoint(
  "/grades/retract",
  ({ session, learner, item, user, at, grade }) =>
    receive({ session, learner, item }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
        .then(Grading.retract({ learner, item, at }).responds({ grade }))
        .then(respond({ grade }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesExcuse = endpoint(
  "/grades/excuse",
  ({ session, learner, item, feedback, user, at, grade }) =>
    receive({ session, learner, item, feedback }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageGrades({ user }),
      )
        .then(Grading.excuse({ learner, item, grader: user, feedback, at }).responds({ grade }))
        .then(respond({ grade }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesForMe = endpoint("/grades/for-me", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ grades: theReleasedGradesOf({ learner: user }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("not-student"),
  ),
);

export const GradesForStudent = endpoint("/grades/for-student", ({ session, learner, user }) =>
  receive({ session, learner }).then(
    where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
      .then(respond({ grades: theGradesOf({ learner }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesForItem = endpoint("/grades/for-item", ({ session, item, user }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
      .then(respond({ grades: theGradesOn({ item }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesGradebook = endpoint("/grades/gradebook", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
      .then(respond({ gradebook: theGradebook({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesExport = endpoint("/grades/export", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayViewAllGrades({ user }))
      .then(respond({ csv: "" }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotViewAllGrades({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);
