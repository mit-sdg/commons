import { activeUser } from "../access/session.ts";
import { each, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { isActiveStudent, isNotActiveStudent, mayGrade, mayNotGrade } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

const { Assigning, Profiling, Submitting } = concepts;

/** What is this learner's latest submission for this assignment? */
export const theLatestSubmission = view(
  "the latest submission for (assignment) by (submitter)",
  ({ assignment, submitter }, { latest }, _bindings) =>
    where(Submitting._getLatest({ assignment, submitter }).is({ latest })),
).optional();

/** Which attempts has this learner made for this assignment? */
export const theAttempts = former(
  "the attempts for (assignment) by (submitter)",
  ({ assignment, submitter }, { submission, artifacts, submittedAt, number, status }) =>
    each(
      Submitting._getAttempts({ assignment, submitter }).is({
        submission,
        artifacts,
        submittedAt,
        number,
        status,
      }),
    ).form({ submission, artifacts, submittedAt, number, status }),
);

/** Which submissions belong to this assignment? */
export const theSubmissionsForAssignment = former(
  "the submissions for (assignment)",
  ({ assignment }, { submitter, submitterName, submission, submittedAt, number, status }) =>
    each(
      Submitting._getSubmissionsForAssignment({ assignment }).is({
        submitter,
        submission,
        submittedAt,
        number,
        status,
      }),
    )
      .where(
        whether(
          Profiling._getProfileFields({ user: submitter }).is({ displayName: submitterName }),
        ),
      )
      .form({ submitter, submitterName, submission, submittedAt, number, status }),
);

/** Who was assigned this assignment? */
export const theAssignedPopulationForAssignment = former(
  "the assigned population for (assignment)",
  ({ assignment }, { assignee, displayName, release, dueOverride, releaseStatus }) =>
    each(Assigning._getAssignees({ assignment }).is({ assignee }))
      .where(
        whether(Profiling._getProfileFields({ user: assignee }).is({ displayName })),
        Assigning._getAssigned({ assignee }).is({
          assignment,
          release,
          dueOverride,
          status: releaseStatus,
        }),
      )
      .form({ assignee, displayName, release, dueOverride, status: releaseStatus }),
);

/** Which submissions belong to this learner? */
export const theSubmissionsBy = former(
  "the submissions by (submitter)",
  ({ submitter }, { assignment, submission, submittedAt, number, status }) =>
    each(
      Submitting._getSubmissionsForSubmitter({ submitter }).is({
        assignment,
        submission,
        submittedAt,
        number,
        status,
      }),
    ).form({ assignment, submission, submittedAt, number, status }),
);

export const Latest = endpoint(
  "/submissions/latest",
  ({ session, assignment, submitter, latest, user }) =>
    receive({ session, assignment, submitter }).then(
      where(
        activeUser({ session }).is({ user: submitter }),
        isActiveStudent({ user: submitter }),
        theLatestSubmission({ assignment, submitter }).is({ latest }),
      )
        .then(respond({ submission: latest }))
        .named("self-found"),
      where(
        activeUser({ session }).is({ user: submitter }),
        isActiveStudent({ user: submitter }),
        no(theLatestSubmission({ assignment, submitter })),
      )
        .then(respond({ submission: null }))
        .named("self-missing"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGrade({ user }),
        isActiveStudent({ user: submitter }),
        theLatestSubmission({ assignment, submitter }).is({ latest }),
      )
        .then(respond({ submission: latest }))
        .named("staff-found"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGrade({ user }),
        isActiveStudent({ user: submitter }),
        no(theLatestSubmission({ assignment, submitter })),
      )
        .then(respond({ submission: null }))
        .named("staff-missing"),
      where(activeUser({ session }).is({ user }).is.not({ user: submitter }), mayNotGrade({ user }))
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
        .then(respond({ attempts: theAttempts({ assignment, submitter }) }))
        .named("attempts"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayGrade({ user }),
        isActiveStudent({ user: submitter }),
      )
        .then(respond({ attempts: theAttempts({ assignment, submitter }) }))
        .named("staff-attempts"),
      where(activeUser({ session }).is({ user }).is.not({ user: submitter }), mayNotGrade({ user }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("attempts-hidden"),
      where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("attempts-missing"),
    ),
);

export const ForAssignment = endpoint(
  "/submissions/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment }).then(
      where(activeUser({ session }).is({ user }), mayGrade({ user }))
        .then(
          respond({
            assigned: theAssignedPopulationForAssignment({ assignment }),
            submissions: theSubmissionsForAssignment({ assignment }),
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
      .then(respond({ submissions: theSubmissionsBy({ submitter }) }))
      .named("for-student"),
    where(
      activeUser({ session }).is({ user }).is.not({ user: submitter }),
      mayGrade({ user }),
      isActiveStudent({ user: submitter }),
    )
      .then(respond({ submissions: theSubmissionsBy({ submitter }) }))
      .named("staff-for-student"),
    where(activeUser({ session }).is({ user }).is.not({ user: submitter }), mayNotGrade({ user }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("for-student-hidden"),
    where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
      .then(respond({ error: "NOT_FOUND" }))
      .named("for-student-missing"),
  ),
);
