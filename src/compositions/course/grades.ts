import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  compute,
  each,
  form,
  former,
  is,
  no,
  now,
  view,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { concepts, computations as c } from "../../concepts.ts";
import { isActiveStudent, isNotActiveStudent, mayGrade, mayNotGrade } from "../access/policy.ts";
import { activeUser } from "../access/session.ts";

const { Assigning, Grading, Itemizing, Profiling, Rostering, StandardSetting, Submitting } =
  concepts;

export const mayReadItem = view(
  "(user) may read assessment item (item)",
  ({ user, item }, _outputs, _bindings) => [
    where(mayGrade({ user })),
    where(
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment: item, assignee: user }).is({ assigned: true }),
      Assigning._getAssignments({}).is({ assignment: item, status: "PUBLISHED" }),
    ),
  ],
).holds();

export const mayReadAssessment = view(
  "(user) may read assessment (grade)",
  ({ user, grade }, _outputs, { status }) => [
    where(mayGrade({ user })),
    where(
      isActiveStudent({ user }),
      Grading._getGrade({ grade }).is({ learner: user, status }),
      is.among(status, ["RELEASED", "EXCUSED"]),
    ),
  ],
).holds();

export const mayStartAssessment = view(
  "(learner) may start assessment on (item) using (evidence)",
  ({ learner, item, evidence }, _outputs, _bindings) => [
    where(
      isActiveStudent({ user: learner }),
      Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
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
    where(
      isActiveStudent({ user: learner }),
      Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
      Assigning._getAssignments({}).is({
        assignment: item,
        status: "PUBLISHED",
        acceptsSubmissions: true,
      }),
      Assigning._isAssigned({ assignment: item, assignee: learner }).is({ assigned: true }),
      is.among(evidence, [""]),
    ),
  ],
).holds();

export const theSetupOf = former(
  "the resolved grading setup of (item)",
  (
    { item },
    {
      label,
      status,
      method,
      revision,
      storedCriteria,
      maxPoints,
      editions,
      criteria,
    },
  ) =>
    each(
      Itemizing._getSetup({ item }).is({
        item,
        label,
        status,
        method,
        revision,
        criteria: storedCriteria,
        maxPoints,
      }),
    )
      .where(
        StandardSetting._getEditionCatalog({}).is({ editions }),
        compute(c.resolveGradingCriteria, { criteria: storedCriteria, editions }, criteria),
      )
      .form({ item, label, status, method, revision, criteria, maxPoints }),
);

export const theReleasedGradesOf = former(
  "the released assessments of (learner)",
  (
    { learner },
    {
      grade,
      item,
      evidence,
      grader,
      method,
      setupRevision,
      criteria,
      judgments,
      feedback,
      status,
      version,
      score,
      outOf,
      scored,
      createdAt,
      updatedAt,
      releasedAt,
      history,
      label,
      submittedAt,
      number,
    },
  ) =>
    each(
      Grading._getGradesForLearner({ learner }).is({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
      }),
    )
      .where(
        is.among(status, ["RELEASED", "EXCUSED"]),
        whether(Itemizing._getItem({ item }).is({ label })),
        whether(
          Submitting._getAttempts({ assignment: item, submitter: learner }).is({
            submission: evidence,
            submittedAt,
            number,
          }),
        ),
      )
      .form({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
        label,
        submittedAt,
        attempt: number,
      }),
);

export const theGradesOf = former(
  "the assessments of (learner)",
  (
    { learner },
    {
      grade,
      item,
      evidence,
      grader,
      method,
      setupRevision,
      criteria,
      judgments,
      feedback,
      status,
      version,
      score,
      outOf,
      scored,
      createdAt,
      updatedAt,
      releasedAt,
      history,
      label,
      submittedAt,
      number,
    },
  ) =>
    each(
      Grading._getGradesForLearner({ learner }).is({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
      }),
    )
      .where(
        whether(Itemizing._getItem({ item }).is({ label })),
        whether(
          Submitting._getAttempts({ assignment: item, submitter: learner }).is({
            submission: evidence,
            submittedAt,
            number,
          }),
        ),
      )
      .form({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
        label,
        submittedAt,
        attempt: number,
      }),
);

export const theGradesOn = former(
  "the assessments on (item)",
  (
    { item },
    {
      grade,
      learner,
      evidence,
      grader,
      method,
      setupRevision,
      criteria,
      judgments,
      feedback,
      status,
      version,
      score,
      outOf,
      scored,
      createdAt,
      updatedAt,
      releasedAt,
      history,
      displayName,
      submittedAt,
      number,
    },
  ) =>
    each(
      Grading._getGradesForItem({ item }).is({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
      }),
    )
      .where(
        whether(Profiling._getProfileFields({ user: learner }).is({ displayName })),
        whether(
          Submitting._getAttempts({ assignment: item, submitter: learner }).is({
            submission: evidence,
            submittedAt,
            number,
          }),
        ),
      )
      .form({
        grade,
        learner,
        displayName,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
        submittedAt,
        attempt: number,
      }),
);

export const theAssessment = former(
  "the assessment (grade)",
  (
    { grade },
    {
      learner,
      item,
      evidence,
      grader,
      method,
      setupRevision,
      criteria,
      judgments,
      feedback,
      status,
      version,
      score,
      outOf,
      scored,
      createdAt,
      updatedAt,
      releasedAt,
      history,
      label,
      submittedAt,
      number,
    },
  ) =>
    each(
      Grading._getGrade({ grade }).is({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
      }),
    )
      .where(
        whether(Itemizing._getItem({ item }).is({ label })),
        whether(
          Submitting._getAttempts({ assignment: item, submitter: learner }).is({
            submission: evidence,
            submittedAt,
            number,
          }),
        ),
      )
      .form({
        grade,
        learner,
        item,
        evidence,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
        version,
        score,
        outOf,
        scored,
        createdAt,
        updatedAt,
        releasedAt,
        history,
        label,
        submittedAt,
        attempt: number,
      }),
);

export const theGradebookLearners = former(
  "the gradebook learners ()",
  (_inputs, { user, seat, section, email, displayName }) =>
    each(Rostering._getActiveStudents({}).is({ user, seat, section, email }))
      .where(whether(Profiling._getProfileFields({ user }).is({ displayName })))
      .form({
        user,
        seat,
        section,
        email,
        displayName,
        grades: theGradesOf({ learner: user }),
      }),
);

export const theGradebook = former(
  "the gradebook ()",
  (_inputs, { item, label, method, revision, maxPoints }) =>
    form({
      items: each(
        Itemizing._getItems({}).is({ item, label, method, revision, maxPoints }),
      ).form({ item, label, method, revision, maxPoints }),
      learners: theGradebookLearners({}),
    }),
);

export const theStandards = former(
  "the current standards ()",
  (
    _inputs,
    {
      standard,
      edition,
      number,
      name,
      description,
      deficient,
      emergent,
      competent,
      expert,
      referenceUrl,
    },
  ) =>
    each(
      StandardSetting._getStandards({}).is({
        standard,
        edition,
        number,
        name,
        description,
        deficient,
        emergent,
        competent,
        expert,
        referenceUrl,
      }),
    ).form({
      standard,
      edition,
      number,
      name,
      description,
      deficient,
      emergent,
      competent,
      expert,
      referenceUrl,
    }),
);

export const GradesDefineStandard = endpoint(
  "/grades/define-standard",
  ({ session, name, description, deficient, emergent, competent, expert, referenceUrl, user, at, standard, edition }) =>
    receive({ session, name, description, deficient, emergent, competent, expert, referenceUrl }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(StandardSetting.define({ name, description, deficient, emergent, competent, expert, referenceUrl }).responds({ standard, edition }))
        .then(respond({ standard, edition }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesReviseStandard = endpoint(
  "/grades/revise-standard",
  ({ session, standard, expectedEdition, name, description, deficient, emergent, competent, expert, referenceUrl, user, at, edition }) =>
    receive({ session, standard, expectedEdition, name, description, deficient, emergent, competent, expert, referenceUrl }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(StandardSetting.revise({ standard, expectedEdition, name, description, deficient, emergent, competent, expert, referenceUrl }).responds({ standard, edition }))
        .then(respond({ standard, edition }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesConfigureItem = endpoint(
  "/grades/configure-item",
  ({ session, item, label, user, gradeItem }) =>
    receive({ session, item, label }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        Assigning._getAssignments({}).is({ assignment: item }),
      )
        .then(Itemizing.configureItem({ item, label }).responds({ gradeItem }))
        .then(respond({ gradeItem }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(Assigning._getAssignments({}).is({ assignment: item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesConfigureSetup = endpoint(
  "/grades/configure-setup",
  ({
    session,
    item,
    method,
    revision,
    criteria,
    user,
    editionIds,
    gradeItem,
    savedRevision,
    label,
    status,
    savedMethod,
    savedCriteria,
    resolvedCriteria,
    maxPoints,
    editions,
  }) =>
    receive({ session, item, method, revision, criteria }).then(
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
        compute(c.competencyEditionIds, { criteria }, editionIds),
        StandardSetting._hasEditions({ editions: editionIds }).is({ valid: true }),
        StandardSetting._getEditionCatalog({}).is({ editions }),
        compute(c.resolveGradingCriteria, { criteria, editions }, resolvedCriteria),
      )
        .then(
          Itemizing.configureSetup({
            item,
            method,
            revision,
            criteria,
            resolvedCriteria,
          }).responds({
            gradeItem,
            label,
            status,
            method: savedMethod,
            revision: savedRevision,
            criteria: savedCriteria,
            maxPoints,
          }),
        )
        .then(
          respond({
            item,
            label,
            status,
            method: savedMethod,
            revision: savedRevision,
            criteria: savedCriteria,
            maxPoints,
          }),
        )
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        Itemizing._getItem({ item }).is({ status: "ACTIVE" }),
        compute(c.competencyEditionIds, { criteria }, editionIds),
        StandardSetting._hasEditions({ editions: editionIds }).is({ valid: false }),
      )
        .then(respond({ error: "INVALID_REQUEST" }))
        .named("invalid-edition"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(Itemizing._getItem({ item }).is({ status: "ACTIVE" })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesSave = endpoint(
  "/grades/save",
  ({ session, grade, version, judgments, feedback, user, at, saved, savedVersion }) =>
    receive({ session, grade, version, judgments, feedback }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.save({ grade, version, judgments, feedback, grader: user, at }).responds({ grade: saved, version: savedVersion }))
        .then(respond({ grade: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRelease = endpoint(
  "/grades/release",
  ({ session, grade, version, user, at, saved, savedVersion }) =>
    receive({ session, grade, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.release({ grade, version, grader: user, at }).responds({ grade: saved, version: savedVersion }))
        .then(respond({ grade: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRetract = endpoint(
  "/grades/retract",
  ({ session, grade, version, user, at, saved, savedVersion }) =>
    receive({ session, grade, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.retract({ grade, version, grader: user, at }).responds({ grade: saved, version: savedVersion }))
        .then(respond({ grade: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesRestoreExcused = endpoint(
  "/grades/restore-excused",
  ({ session, grade, version, user, at, saved, savedVersion }) =>
    receive({ session, grade, version }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.restoreExcused({ grade, version, grader: user, at }).responds({ grade: saved, version: savedVersion }))
        .then(respond({ grade: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesExcuse = endpoint(
  "/grades/excuse",
  ({ session, grade, version, feedback, user, at, saved, savedVersion }) =>
    receive({ session, grade, version, feedback }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.excuse({ grade, version, grader: user, feedback, at }).responds({ grade: saved, version: savedVersion }))
        .then(respond({ grade: saved, version: savedVersion }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesReleaseItem = endpoint(
  "/grades/release-item",
  ({ session, item, user, at, released, skipped, unconfirmed }) =>
    receive({ session, item }).then(
      where(now(at), activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(Grading.releaseItem({ item, grader: user, at }).responds({ released, skipped, unconfirmed }))
        .then(respond({ released, skipped, unconfirmed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const GradesItem = endpoint(
  "/grades/item",
  ({
    session,
    item,
    user,
    label,
    status,
    method,
    revision,
    storedCriteria,
    editions,
    criteria,
    maxPoints,
  }) =>
    receive({ session, item }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadItem({ user, item }),
        Itemizing._getSetup({ item }).is({
          label,
          status,
          method,
          revision,
          criteria: storedCriteria,
          maxPoints,
        }),
        StandardSetting._getEditionCatalog({}).is({ editions }),
        compute(c.resolveGradingCriteria, { criteria: storedCriteria, editions }, criteria),
      )
        .then(respond({ item, label, status, method, revision, criteria, maxPoints }))
        .named("success"),
      where(activeUser({ session }).is({ user }), no(mayReadItem({ user, item })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayReadItem({ user, item }),
        no(Itemizing._getItem({ item })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
    ),
);

export const GradesDetail = endpoint("/grades/detail", ({ session, grade, user }) =>
  receive({ session, grade }).then(
    where(activeUser({ session }).is({ user }), mayReadAssessment({ user, grade }), Grading._getGrade({ grade }))
      .then(respond({ assessments: theAssessment({ grade }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), no(mayReadAssessment({ user, grade })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("hidden"),
    where(activeUser({ session }).is({ user }), mayReadAssessment({ user, grade }), no(Grading._getGrade({ grade })))
      .then(respond({ error: "NOT_FOUND" }))
      .named("missing"),
  ),
);

export const GradesRecord = endpoint(
  "/grades/record",
  ({
    session,
    learner,
    item,
    evidence,
    revision,
    user,
    at,
    grade,
    version,
    method,
    storedCriteria,
    editions,
    criteria,
    currentRevision,
    revisionMatches,
  }) =>
    receive({ session, learner, item, evidence, revision }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        Grading._getAssessment({ learner, item, evidence }).is({ grade, version, method }),
      )
        .then(respond({ grade, version, method }))
        .named("existing"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(Grading._getAssessment({ learner, item, evidence })),
        mayStartAssessment({ learner, item, evidence }),
        Itemizing._getSetup({ item }).is({
          method,
          revision: currentRevision,
          criteria: storedCriteria,
        }),
        StandardSetting._getEditionCatalog({}).is({ editions }),
        compute(c.resolveGradingCriteria, { criteria: storedCriteria, editions }, criteria),
        compute(c.gradingRevisionMatches, { left: currentRevision, right: revision }, revisionMatches),
        is.among(revisionMatches, [true]),
      )
        .then(
          Grading.record({
            learner,
            item,
            evidence,
            grader: user,
            method,
            setupRevision: currentRevision,
            criteria,
            at,
          }).responds({ grade, version, method }),
        )
        .then(respond({ grade, version, method }))
        .named("created"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(Grading._getAssessment({ learner, item, evidence })),
        mayStartAssessment({ learner, item, evidence }),
        Itemizing._getSetup({ item }).is({ revision: currentRevision }),
        compute(c.gradingRevisionMatches, { left: currentRevision, right: revision }, revisionMatches),
        is.among(revisionMatches, [false]),
      )
        .then(respond({ error: "CONFLICT" }))
        .named("stale-setup"),
      where(
        activeUser({ session }).is({ user }),
        mayGrade({ user }),
        no(Grading._getAssessment({ learner, item, evidence })),
        no(mayStartAssessment({ learner, item, evidence })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("invalid-evidence"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
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

export const GradesStandards = endpoint("/grades/standards", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ standards: theStandards({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesForStudent = endpoint("/grades/for-student", ({ session, user, learner }) =>
  receive({ session, learner }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ grades: theGradesOf({ learner }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesForItem = endpoint("/grades/for-item", ({ session, user, item }) =>
  receive({ session, item }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ grades: theGradesOn({ item }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesGradebook = endpoint("/grades/gradebook", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ gradebook: theGradebook({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const GradesExport = endpoint("/grades/export", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayGrade({ user }))
      .then(respond({ csv: "" }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);
