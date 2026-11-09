import {
  compute,
  each,
  former,
  is,
  no,
  now,
  view,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { activeUser } from "../access/session.ts";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayChangeCourseGrades,
  mayNotChangeCourseGrades,
  mayNotReadClassGrades,
  mayReadClassGrades,
} from "../access/policy.ts";
import { LECTURES } from "../live/lectures.ts";
import { computations as c, concepts } from "../../concepts.ts";

const {
  Assigning,
  Banking,
  CourseGradePublishing,
  CourseGradeSnapshotting,
  Grading,
  Overriding,
  Pinning,
  Policymaking,
  Profiling,
  Publishing,
  Responding,
  Rostering,
  Submitting,
} = concepts;

/** The reserved material whose editions are releases to the class. */
export const COURSE_GRADES = "course-grades";

/**
 * Everything the course-grade calculation reads, gathered from one-row,
 * class-wide reads: assignments, releases, attempts, ratings, standing late
 * days, active students with names, lecture runs with who joined, the class
 * time zone, and standing overrides.
 */
export const theCourseGradeInputs = view(
  "the course-grade inputs",
  (
    _inputs,
    { inputs },
    {
      assignments,
      releases,
      attempts,
      ratings,
      uses,
      unitHours,
      students,
      users,
      names,
      lectures,
      editions,
      parts,
      subjects,
      participation,
      detail,
      overrides,
    },
  ) =>
    where(
      Assigning._courseAssignments({}).is({ assignments }),
      Assigning._courseReleases({}).is({ releases }),
      Submitting._allAttempts({}).is({ attempts }),
      Grading._courseRatings({}).is({ ratings }),
      Banking._standingUses({}).is({ uses }),
      Banking._getTerms({}).is({ unitHours }),
      Rostering._activeStudentList({}).is({ students }),
      compute(c.studentUsers, { students }, users),
      Profiling._namesOf({ users }).is({ names }),
      Pinning._pinnedItems({ scope: LECTURES }).is({ items: lectures }),
      Publishing._editionsAmong({ editions: lectures }).is({ editions }),
      Publishing._partsAmong({ wholes: lectures }).is({ parts }),
      compute(c.lectureSubjectList, { lectures, parts }, subjects),
      Responding._participationAmong({ subjects }).is({ participation }),
      whether(Rostering._getClass({}).is({ detail })),
      Overriding._overrides({}).is({ overrides }),
      compute(
        c.courseGradeInputs,
        {
          assignments,
          releases,
          attempts,
          ratings,
          uses,
          unitHours,
          students,
          names,
          lectures,
          editions,
          parts,
          participation,
          detail,
          overrides,
        },
        inputs,
      ),
    ),
).optional();

/** The final policy at its current version, as a release keeps it. */
export const theFinalPolicy = view(
  "the final course-grade policy",
  (_inputs, { final }, { policy, name, version, specification }) =>
    where(
      Policymaking._final({}).is({ policy, name, version, specification }),
      compute(c.releasedPolicy, { policy, name, version, specification }, final),
    ),
).optional();

/** Every policy, without its specification. */
export const thePolicies = former(
  "the course-grade policies",
  (_inputs, { policy, name, version, author, authorName, savedAt, final }) =>
    each(Policymaking._policies({}).is({ policy, name, version, author, savedAt, final }))
      .where(whether(Profiling._getProfileFields({ user: author }).is({ displayName: authorName })))
      .form({ policy, name, version, author, authorName, savedAt, final }),
);

/** Every release to the class, newest first, without the inputs it was computed from. */
export const theReleaseHistory = former(
  "the course-grade release history",
  (_inputs, { edition, open, openedAt, closedAt, author, authorName, value, summary }) =>
    each(
      CourseGradePublishing._editionsFor({ material: COURSE_GRADES }).is({
        edition,
        open,
        openedAt,
        closedAt,
      }),
    )
      .where(
        CourseGradePublishing._edition({ edition }).is({ author }),
        whether(Profiling._getProfileFields({ user: author }).is({ displayName: authorName })),
        whether(CourseGradeSnapshotting._snapshot({ subject: edition }).is({ value })),
        compute(c.releaseSummary, { value }, summary),
      )
      .form({ edition, open, openedAt, closedAt, authorName, release: summary }),
);

/** The standing updates of single students, newest first, without their inputs. */
export const theStudentUpdates = former(
  "the course-grade student updates",
  (_inputs, { edition, material, openedAt, value, summary }) =>
    each(
      CourseGradePublishing._openEditions({})
        .is({ edition, material, openedAt })
        .is.not({ material: COURSE_GRADES }),
    )
      .where(
        CourseGradeSnapshotting._snapshot({ subject: edition }).is({ value }),
        compute(c.releaseSummary, { value }, summary),
      )
      .form({ edition, student: material, openedAt, update: summary }),
);

/** The page's read: the inputs, the policies, the releases, and the sections. */
export const theCourseGradesPage = former(
  "the course grades page",
  (_inputs, { inputs, section, name }) =>
    where(theCourseGradeInputs({}).is({ inputs })).form({
      inputs,
      policies: thePolicies({}),
      releases: theReleaseHistory({}),
      updates: theStudentUpdates({}),
      sections: each(Rostering._getSections({}).is({ section, name })).form({ section, name }),
    }),
).optional();

export const Read = endpoint("/course-grades/read", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayReadClassGrades({ user }))
      .then(respond({ page: theCourseGradesPage({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotReadClassGrades({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const ReadPolicy = endpoint(
  "/course-grades/policy",
  ({ session, user, policy, name, version, specification, author, authorName, savedAt, final }) =>
    receive({ session, policy }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadClassGrades({ user }),
        Policymaking._policy({ policy }).is({
          name,
          version,
          specification,
          author,
          savedAt,
          final,
        }),
        whether(Profiling._getProfileFields({ user: author }).is({ displayName: authorName })),
      )
        .then(respond({ policy, name, version, specification, author, authorName, savedAt, final }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayReadClassGrades({ user }),
        no(Policymaking._policy({ policy })),
      )
        .then(respond({ error: "POLICY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotReadClassGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy"] } },
);

export const ReadVersion = endpoint(
  "/course-grades/version",
  ({ session, user, policy, version, specification, author, savedAt }) =>
    receive({ session, policy, version }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadClassGrades({ user }),
        Policymaking._version({ policy, version }).is({ specification, author, savedAt }),
      )
        .then(respond({ policy, version, specification, author, savedAt }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayReadClassGrades({ user }),
        no(Policymaking._version({ policy, version })),
      )
        .then(respond({ error: "POLICY_NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotReadClassGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy", "version"] } },
);

export const CreatePolicy = endpoint(
  "/course-grades/create",
  ({ session, user, name, specification, valid, at, policy, version }) =>
    receive({ session, name, specification }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        compute(c.policyIsWellFormed, { specification }, valid),
        is.among(valid, [true]),
      )
        .then(
          Policymaking.create({ name, specification, author: user, at }).responds({
            policy,
            version,
          }),
        )
        .then(respond({ policy, version }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        compute(c.policyIsWellFormed, { specification }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_POLICY" }))
        .named("invalid"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "name", "specification"] } },
);

export const SavePolicy = endpoint(
  "/course-grades/save",
  ({ session, user, policy, version, specification, valid, at, saved }) =>
    receive({ session, policy, version, specification }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        compute(c.policyIsWellFormed, { specification }, valid),
        is.among(valid, [true]),
      )
        .then(
          Policymaking.save({ policy, version, specification, author: user, at }).responds({
            version: saved,
          }),
        )
        .then(respond({ policy, version: saved }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        compute(c.policyIsWellFormed, { specification }, valid),
        is.among(valid, [false]),
      )
        .then(respond({ error: "INVALID_POLICY" }))
        .named("invalid"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy", "version", "specification"] } },
);

export const RenamePolicy = endpoint(
  "/course-grades/rename",
  ({ session, user, policy, name }) =>
    receive({ session, policy, name }).then(
      where(activeUser({ session }).is({ user }), mayChangeCourseGrades({ user }))
        .then(Policymaking.rename({ policy, name }).responds())
        .then(respond({ policy, name }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy", "name"] } },
);

export const RemovePolicy = endpoint(
  "/course-grades/remove",
  ({ session, user, policy }) =>
    receive({ session, policy }).then(
      where(activeUser({ session }).is({ user }), mayChangeCourseGrades({ user }))
        .then(Policymaking.remove({ policy }).responds())
        .then(respond({ policy }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy"] } },
);

export const MarkFinal = endpoint(
  "/course-grades/mark-final",
  ({ session, user, policy }) =>
    receive({ session, policy }).then(
      where(activeUser({ session }).is({ user }), mayChangeCourseGrades({ user }))
        .then(Policymaking.markFinal({ policy }).responds())
        .then(respond({ policy, final: true }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "policy"] } },
);

/**
 * An override records the grade it replaced, computed here from the named
 * policy's saved version over the current inputs; the browser never supplies it.
 */
export const SetOverride = endpoint(
  "/course-grades/override",
  ({
    session,
    user,
    student,
    value,
    reason,
    policy,
    specification,
    inputs,
    replaced,
    at,
    override,
  }) =>
    receive({ session, student, value, reason, policy }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        isActiveStudent({ user: student }),
        Policymaking._policy({ policy }).is({ specification }),
        theCourseGradeInputs({}).is({ inputs }),
        compute(c.overrideReplaced, { specification, inputs, student, at }, replaced),
      )
        .then(
          Overriding.set({ subject: student, value, reason, replaced, author: user, at }).responds({
            override,
          }),
        )
        .then(respond({ student, value, reason, replaced }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        isActiveStudent({ user: student }),
        no(Policymaking._policy({ policy })),
      )
        .then(respond({ error: "POLICY_NOT_FOUND" }))
        .named("no-policy"),
      where(
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        isNotActiveStudent({ user: student }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("not-a-student"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "student", "value", "reason", "policy"] } },
);

export const ClearOverride = endpoint(
  "/course-grades/clear-override",
  ({ session, user, student }) =>
    receive({ session, student }).then(
      where(activeUser({ session }).is({ user }), mayChangeCourseGrades({ user }))
        .then(Overriding.clear({ subject: student }).responds())
        .then(respond({ student }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "student"] } },
);

/** The final grades as CSV, under the final policy as saved, as of now. */
export const Export = endpoint(
  "/grades/export",
  ({ session, user, final, inputs, sections, csv, at }) =>
    receive({ session }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        theFinalPolicy({}).is({ final }),
        theCourseGradeInputs({}).is({ inputs }),
        Rostering._sectionList({}).is({ sections }),
        compute(c.courseGradesCsv, { policy: final, inputs, sections, at }, csv),
      )
        .then(respond({ csv }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayChangeCourseGrades({ user }),
        no(theFinalPolicy({})),
      )
        .then(respond({ error: "NO_FINAL_POLICY" }))
        .named("no-final"),
      where(activeUser({ session }).is({ user }), mayNotChangeCourseGrades({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);
