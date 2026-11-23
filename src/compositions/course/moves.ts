import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, each, former, is, no, now, view, where } from "@mit-sdg/sync-engine/language";
import { computations as c, concepts } from "../../concepts.ts";
import {
  isActiveStudent,
  mayGradeWork,
  mayManageCourse,
  mayNotManageCourse,
  theSubmitterFor,
} from "../access/policy.ts";
import { activeUser } from "../access/session.ts";

const { Assigning, Grading, Submitting } = concepts;

/** Whether an attempt of someone other than this student holds these artifacts: a copy made by a move. */
export const heldByAnother = view(
  "(artifacts) on (assignment) are held by an attempt not of (student)",
  ({ assignment, artifacts, student }, _outputs, _bindings) =>
    where(
      Submitting._getSubmissionsForAssignment({ assignment })
        .is({ artifacts })
        .is.not({ submitter: student }),
    ),
).holds();

/** Whether the section holds an attempt handed in after this time. */
export const hasLaterAttempt = view(
  "(section) holds an attempt on (assignment) handed in after (submittedAt)",
  ({ assignment, section, submittedAt }, _outputs, { later }) =>
    where(
      Submitting._getAttempts({ assignment, submitter: section }).is({ submittedAt: later }),
      is.gt(later, submittedAt),
    ),
).holds();

/**
 * Which submitted attempts of a section's current members has no section an
 * attempt for? An attempt and its copy hold the same artifact, and an attempt
 * is moved once: a member who later changes sections leaves the copy behind.
 * An attempt older than one the section already holds is not offered, since
 * its copy would take the next number and stand as the section's latest.
 */
export const theUnmovedAttempts = view(
  "the attempts on (assignment) not yet moved to a section",
  ({ assignment }, { student, section, submission, artifacts, submittedAt }, _bindings) =>
    where(
      Assigning._getAssignments({}).is({ assignment, submittedBy: "SECTION" }),
      Submitting._getSubmissionsForAssignment({ assignment }).is({
        submitter: student,
        submission,
        artifacts,
        submittedAt,
        status: "SUBMITTED",
      }),
      isActiveStudent({ user: student }),
      theSubmitterFor({ assignment, student })
        .is({ submitter: section })
        .is.not({ submitter: student }),
      no(heldByAnother({ assignment, artifacts, student })),
      no(hasLaterAttempt({ assignment, section, submittedAt })),
    ),
);

/**
 * Which draft or released assessments of a member's own attempt has the copy
 * of that attempt not taken: the copy has no assessment, or one at its first
 * version, which nobody has saved?
 */
export const theUncopiedGrades = view(
  "the assessments on (assignment) not yet copied to a section's attempt",
  (
    { assignment },
    { section, moved, grader, method, setupRevision, criteria, judgments, feedback },
    { student, original, artifacts, status },
  ) => {
    const ofAMovedAttempt = [
      Assigning._getAssignments({}).is({ assignment, submittedBy: "SECTION" }),
      Grading._getGradesForItem({ item: assignment }).is({
        learner: student,
        evidence: original,
        grader,
        method,
        setupRevision,
        criteria,
        judgments,
        feedback,
        status,
      }),
      is.among(status, ["DRAFT", "RELEASED"]),
      isActiveStudent({ user: student }),
      theSubmitterFor({ assignment, student })
        .is({ submitter: section })
        .is.not({ submitter: student }),
      Submitting._getAttempts({ assignment, submitter: student }).is({
        submission: original,
        artifacts,
      }),
      Submitting._getAttempts({ assignment, submitter: section }).is({
        submission: moved,
        artifacts,
      }),
    ] as const;
    return [
      where(
        ...ofAMovedAttempt,
        no(Grading._getAssessment({ learner: section, item: assignment, evidence: moved })),
      ),
      where(
        ...ofAMovedAttempt,
        Grading._getAssessment({ learner: section, item: assignment, evidence: moved }).is({
          version: 1,
        }),
      ),
    ];
  },
);

/** Which unmoved attempts belong to sections this caller may grade? */
export const theUnmovedSubmissions = former(
  "the submissions to (assignment) not yet moved that (user) may grade",
  ({ assignment, user }, { student, section, submission }) =>
    each(theUnmovedAttempts({ assignment }).is({ student, section, submission }))
      .where(mayGradeWork({ user, learner: section, item: assignment }))
      .form({ student, section, submission }),
);

/** Each unmoved attempt becomes an attempt of the member's section, with the same artifact and time. */
export const MoveToSections = endpoint(
  "/submissions/move-to-sections",
  ({ session, assignment, user, section, artifacts, artifact, submittedAt }) =>
    receive({ session, assignment })
      .where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        theUnmovedAttempts({ assignment }).is({ section, artifacts, submittedAt }),
        compute(c.soleArtifact, { artifacts }, artifact),
      )
      .then(Submitting.submit({ assignment, submitter: section, artifact, at: submittedAt })),
);

/**
 * Once the attempts are moved, each uncopied assessment is recorded on the
 * copy with its criteria, method, setup revision, and grader, and then saved
 * with its judgments and feedback while the copy is still at its first version.
 */
export const MoveCopiesGrades = endpoint(
  "/submissions/move-to-sections",
  ({
    session,
    assignment,
    user,
    at,
    section,
    moved,
    grader,
    method,
    setupRevision,
    criteria,
    judgments,
    feedback,
    grade,
  }) =>
    receive({ session, assignment })
      .afterFlowSettles()
      .where(
        now(at),
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        theUncopiedGrades({ assignment }).is({
          section,
          moved,
          grader,
          method,
          setupRevision,
          criteria,
        }),
      )
      .then(
        Grading.record({
          learner: section,
          item: assignment,
          evidence: moved,
          grader,
          method,
          setupRevision,
          criteria,
          at,
        }).responds({ grade, version: 1 }),
      )
      .afterFlowSettles()
      .where(theUncopiedGrades({ assignment }).is({ section, moved, judgments, feedback }))
      .then(Grading.save({ grade, version: 1, grader, judgments, feedback, at })),
);

/** The request is answered once nothing is left to move or copy. */
export const MoveAnswers = endpoint(
  "/submissions/move-to-sections",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .afterFlowSettles()
      .where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        Assigning._getAssignments({}).is({ assignment }),
        no(theUnmovedAttempts({ assignment })),
        no(theUncopiedGrades({ assignment })),
      )
      .then(respond({ assignment })),
);

export const MoveRefusals = endpoint(
  "/submissions/move-to-sections",
  ({ session, assignment, user }) =>
    receive({ session, assignment }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        no(Assigning._getAssignments({}).is({ assignment })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);
