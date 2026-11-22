import { activeUser } from "../access/session.ts";
import { each, former, is, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayGrade,
  mayGradeStudentWork,
  mayGradeWork,
  mayNotGrade,
  mayNotGradeStudentWork,
  theSubmitterFor,
} from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

const { Assigning, Authenticating, Formatting, Posting, Profiling, Rostering, Submitting } =
  concepts;

/** What is the latest submission standing for this student on this assignment? */
export const theLatestSubmission = view(
  "the latest submission of (assignment) for (student)",
  ({ assignment, student }, { latest }, { submitter }) =>
    where(
      theSubmitterFor({ assignment, student }).is({ submitter }),
      Submitting._getLatest({ assignment, submitter }).is({ latest }),
    ),
).optional();

/** Which attempts stand for this student on this assignment: their section's, or their own? */
export const theStandingAttempts = view(
  "the attempts of (assignment) that stand for (student)",
  (
    { assignment, student },
    { submission, artifacts, submittedAt, number, status },
    { submitter },
  ) =>
    where(
      theSubmitterFor({ assignment, student }).is({ submitter }),
      Submitting._getAttempts({ assignment, submitter }).is({
        submission,
        artifacts,
        submittedAt,
        number,
        status,
      }),
    ),
);

/**
 * Which attempts stand for this student across assignments: their own where
 * they submit, and their section's where the section does.
 */
export const theStandingSubmissions = view(
  "the submissions that stand for (student)",
  ({ student }, { assignment, submission, submittedAt, number, status }, { section }) => [
    where(
      Submitting._getSubmissionsForSubmitter({ submitter: student }).is({
        assignment,
        submission,
        submittedAt,
        number,
        status,
      }),
      theSubmitterFor({ assignment, student }).is({ submitter: student }),
    ),
    where(
      Rostering._getSeatByUser({ user: student }).is({ section }),
      Submitting._getSubmissionsForSubmitter({ submitter: section }).is({
        assignment,
        submission,
        submittedAt,
        number,
        status,
      }),
      theSubmitterFor({ assignment, student }).is({ submitter: section }),
    ),
  ],
);

export const submissionHasArtifact = view(
  "(assignment) by (submitter) has submission artifact (artifact)",
  ({ assignment, submitter, artifact }, _outputs, { artifacts }) =>
    where(
      Submitting._getAttempts({ assignment, submitter }).is({ artifacts }),
      is.among(artifact, artifacts),
    ),
).holds();

export const mayReadSubmissionArtifact = view(
  "(user) may read (artifact) that stands for (student) on (assignment)",
  ({ user, artifact, student, assignment }, _outputs, { submitter }) => [
    where(
      isActiveStudent({ user }),
      theSubmitterFor({ assignment, student: user }).is({ submitter }),
      submissionHasArtifact({ assignment, submitter, artifact }),
    ),
    where(
      mayGradeStudentWork({ user, student, item: assignment }),
      isActiveStudent({ user: student }),
      theSubmitterFor({ assignment, student }).is({ submitter }),
      submissionHasArtifact({ assignment, submitter, artifact }),
    ),
  ],
).holds();

/** Which attempts stand for this student on this assignment? */
export const theAttempts = former(
  "the attempts of (assignment) for (student)",
  ({ assignment, student }, { submission, artifacts, submittedAt, number, status }) =>
    each(
      theStandingAttempts({ assignment, student }).is({
        submission,
        artifacts,
        submittedAt,
        number,
        status,
      }),
    ).form({ submission, artifacts, submittedAt, number, status }),
);

/** Which submissions to this assignment may this caller grade? */
export const theSubmissionsForAssignment = former(
  "the submissions for (assignment) that (user) may grade",
  (
    { assignment, user },
    { submitter, submitterName, submission, artifacts, submittedAt, number, status },
  ) =>
    each(
      Submitting._getSubmissionsForAssignment({ assignment }).is({
        submitter,
        submission,
        artifacts,
        submittedAt,
        number,
        status,
      }),
    )
      .where(
        mayGradeWork({ user, learner: submitter, item: assignment }),
        whether(
          Profiling._getProfileFields({ user: submitter }).is({ displayName: submitterName }),
        ),
      )
      .form({
        submitter,
        submitterName,
        submission,
        artifacts,
        submittedAt,
        number,
        status,
      }),
);

/** Which of this assignment's assignees may this caller grade, with who submits for each, their seat's standing, and the identity fields a staff export needs? */
export const theAssignedPopulationForAssignment = former(
  "the assigned population for (assignment) that (user) may grade",
  (
    { assignment, user },
    {
      assignee,
      displayName,
      username,
      email,
      section,
      enrolment,
      submitter,
      release,
      dueOverride,
      releaseStatus,
    },
  ) =>
    each(Assigning._getAssignees({ assignment }).is({ assignee }))
      .where(
        mayGradeStudentWork({ user, student: assignee, item: assignment }),
        theSubmitterFor({ assignment, student: assignee }).is({ submitter }),
        whether(Profiling._getProfileFields({ user: assignee }).is({ displayName })),
        whether(Authenticating._getById({ user: assignee }).is({ username })),
        whether(
          Rostering._getSeatByUser({ user: assignee }).is({ email, section, status: enrolment }),
        ),
        Assigning._getAssigned({ assignee }).is({
          assignment,
          release,
          dueOverride,
          status: releaseStatus,
        }),
      )
      .form({
        assignee,
        displayName,
        username,
        email,
        section,
        enrolment,
        submitter,
        release,
        dueOverride,
        status: releaseStatus,
      }),
);

/** Which submissions stand for this student? */
export const theSubmissionsBy = former(
  "the submissions for (student)",
  ({ student }, { assignment, submission, submittedAt, number, status }) =>
    each(
      theStandingSubmissions({ student }).is({
        assignment,
        submission,
        submittedAt,
        number,
        status,
      }),
    ).form({ assignment, submission, submittedAt, number, status }),
);

/** Which of the submissions standing for this student may this caller grade? */
export const theGradableSubmissionsBy = former(
  "the submissions for (student) that (user) may grade",
  ({ student, user }, { assignment, submission, submittedAt, number, status }) =>
    each(
      theStandingSubmissions({ student }).is({
        assignment,
        submission,
        submittedAt,
        number,
        status,
      }),
    )
      .where(mayGradeStudentWork({ user, student, item: assignment }))
      .form({ assignment, submission, submittedAt, number, status }),
);

export const Latest = endpoint(
  "/submissions/latest",
  ({ session, assignment, submitter, latest, user }) =>
    receive({ session, assignment, submitter }).then(
      where(
        activeUser({ session }).is({ user: submitter }),
        isActiveStudent({ user: submitter }),
        theLatestSubmission({ assignment, student: submitter }).is({ latest }),
      )
        .then(respond({ submission: latest }))
        .named("self-found"),
      where(
        activeUser({ session }).is({ user: submitter }),
        isActiveStudent({ user: submitter }),
        no(theLatestSubmission({ assignment, student: submitter })),
      )
        .then(respond({ submission: null }))
        .named("self-missing"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGradeStudentWork({ user, student: submitter, item: assignment }),
        isActiveStudent({ user: submitter }),
        theLatestSubmission({ assignment, student: submitter }).is({ latest }),
      )
        .then(respond({ submission: latest }))
        .named("staff-found"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGradeStudentWork({ user, student: submitter, item: assignment }),
        isActiveStudent({ user: submitter }),
        no(theLatestSubmission({ assignment, student: submitter })),
      )
        .then(respond({ submission: null }))
        .named("staff-missing"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayNotGradeStudentWork({ user, student: submitter, item: assignment }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("latest-hidden"),
      where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("latest-missing"),
    ),
);

export const Attempts = endpoint(
  "/submissions/attempts",
  ({ session, assignment, submitter, user }) =>
    receive({ session, assignment, submitter }).then(
      where(activeUser({ session }).is({ user: submitter }), isActiveStudent({ user: submitter }))
        .then(respond({ attempts: theAttempts({ assignment, student: submitter }) }))
        .named("attempts"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGradeStudentWork({ user, student: submitter, item: assignment }),
        isActiveStudent({ user: submitter }),
      )
        .then(respond({ attempts: theAttempts({ assignment, student: submitter }) }))
        .named("staff-attempts"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayNotGradeStudentWork({ user, student: submitter, item: assignment }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("attempts-hidden"),
      where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("attempts-missing"),
    ),
);

/** What submission artifact may this account inspect? */
export const theArtifactPost = former(
  "the artifact (artifact) of (assignment) standing for (student), for (user)",
  ({ artifact, assignment, student, user }, { author, content, createdAt, editedAt, rendered }) =>
    where(
      mayReadSubmissionArtifact({ user, assignment, student, artifact }),
      Posting._getPost({ post: artifact }).is({ author, content, createdAt, editedAt }),
      Formatting._getRendered({ target: artifact }).is({ rendered }),
    ).form({ author, content, createdAt, editedAt, rendered }),
);

export const Artifact = endpoint(
  "/submissions/artifact",
  ({ session, assignment, submitter, artifact, user }) =>
    receive({ session, assignment, submitter, artifact }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadSubmissionArtifact({ user, assignment, student: submitter, artifact }),
      )
        .then(
          respond({ post: theArtifactPost({ artifact, assignment, student: submitter, user }) }),
        )
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        no(mayReadSubmissionArtifact({ user, assignment, student: submitter, artifact })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
    ),
  { input: { required: ["session", "assignment", "submitter", "artifact"] } },
);

export const ForAssignment = endpoint(
  "/submissions/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment }).then(
      where(activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          respond({
            assigned: theAssignedPopulationForAssignment({ assignment, user }),
            submissions: theSubmissionsForAssignment({ assignment, user }),
          }),
        )
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotGrade({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ForStudent = endpoint("/submissions/for-student", ({ session, submitter, user }) =>
  receive({ session, submitter }).then(
    where(activeUser({ session }).is({ user: submitter }), isActiveStudent({ user: submitter }))
      .then(respond({ submissions: theSubmissionsBy({ student: submitter }) }))
      .named("for-student"),
    where(
      activeUser({ session }).is({ user }).is.not({ user: submitter }),
      mayGrade({ user }),
      isActiveStudent({ user: submitter }),
    )
      .then(respond({ submissions: theGradableSubmissionsBy({ student: submitter, user }) }))
      .named("staff-for-student"),
    where(activeUser({ session }).is({ user }).is.not({ user: submitter }), mayNotGrade({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("for-student-hidden"),
    where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("for-student-missing"),
  ),
);
