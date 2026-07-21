import { activeUser } from "../access/session.ts";
import { each, former, no, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayNotViewAllSubmissions,
  mayViewAllSubmissions,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Assigning, Rostering, Submitting } = concepts;

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
      .where(Rostering._getSeatByUser({ user: submitter }).is({ rosterName: submitterName }))
      .form({ submitter, submitterName, submission, submittedAt, number, status }),
);

/** Who was assigned this assignment? */
export const theAssignedPopulationForAssignment = former(
  "the assigned population for (assignment)",
  ({ assignment }, { assignee, rosterName }) =>
    each(Assigning._getAssignees({ assignment }).is({ assignee }))
      .where(Rostering._getSeatByUser({ user: assignee }).is({ rosterName }))
      .form({ assignee, rosterName }),
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
  ({ session, assignment, submitter, latest }) =>
    receive({ session, assignment, submitter })
      .where(activeUser({ session }).is({ user: submitter }), isActiveStudent({ user: submitter }))
      .then(
        where(theLatestSubmission({ assignment, submitter }).is({ latest }))
          .then(respond({ submission: latest }))
          .named("case-1"),
        where(no(theLatestSubmission({ assignment, submitter })))
          .then(respond({ submission: null }))
          .named("case-2"),
      ),
);
export const StaffLatest = endpoint(
  "/submissions/latest",
  ({ session, assignment, submitter, user, latest }) =>
    receive({ session, assignment, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayViewAllSubmissions({ user }),
        isActiveStudent({ user: submitter }),
      )
      .then(
        where(theLatestSubmission({ assignment, submitter }).is({ latest }))
          .then(respond({ submission: latest }))
          .named("case-1"),
        where(no(theLatestSubmission({ assignment, submitter })))
          .then(respond({ submission: null }))
          .named("case-2"),
      ),
);

export const Attempts = endpoint("/submissions/attempts", ({ session, assignment, submitter }) =>
  receive({ session, assignment, submitter })
    .where(activeUser({ session }).is({ user: submitter }), isActiveStudent({ user: submitter }))
    .then(respond({ attempts: theAttempts({ assignment, submitter }) })),
);
export const StaffAttempts = endpoint(
  "/submissions/attempts",
  ({ session, assignment, submitter, user }) =>
    receive({ session, assignment, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayViewAllSubmissions({ user }),
        isActiveStudent({ user: submitter }),
      )
      .then(respond({ attempts: theAttempts({ assignment, submitter }) })),
);

export const ForAssignment = endpoint(
  "/submissions/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayViewAllSubmissions({ user }))
      .then(
        respond({
          assigned: theAssignedPopulationForAssignment({ assignment }),
          submissions: theSubmissionsForAssignment({ assignment }),
        }),
      ),
);

export const ForAssignmentForbidden = endpoint(
  "/submissions/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayNotViewAllSubmissions({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const ForStudent = endpoint("/submissions/for-student", ({ session, submitter }) =>
  receive({ session, submitter })
    .where(activeUser({ session }).is({ user: submitter }), isActiveStudent({ user: submitter }))
    .then(respond({ submissions: theSubmissionsBy({ submitter }) })),
);
export const StaffForStudent = endpoint(
  "/submissions/for-student",
  ({ session, submitter, user }) =>
    receive({ session, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayViewAllSubmissions({ user }),
        isActiveStudent({ user: submitter }),
      )
      .then(respond({ submissions: theSubmissionsBy({ submitter }) })),
);

export const LatestHidden = endpoint(
  "/submissions/latest",
  ({ session, assignment, submitter, user }) =>
    receive({ session, assignment, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayNotViewAllSubmissions({ user }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);
export const AttemptsHidden = endpoint(
  "/submissions/attempts",
  ({ session, assignment, submitter, user }) =>
    receive({ session, assignment, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayNotViewAllSubmissions({ user }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);
export const ForStudentHidden = endpoint(
  "/submissions/for-student",
  ({ session, submitter, user }) =>
    receive({ session, submitter })
      .where(
        activeUser({ session }).is({ user }).is.not({ user: submitter }),
        mayNotViewAllSubmissions({ user }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);
export const LatestMissing = endpoint("/submissions/latest", ({ session, assignment, submitter }) =>
  receive({ session, assignment, submitter })
    .where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
    .then(respond({ error: "NOT_FOUND" })),
);
export const AttemptsMissing = endpoint(
  "/submissions/attempts",
  ({ session, assignment, submitter }) =>
    receive({ session, assignment, submitter })
      .where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
      .then(respond({ error: "NOT_FOUND" })),
);
export const ForStudentMissing = endpoint("/submissions/for-student", ({ session, submitter }) =>
  receive({ session, submitter })
    .where(activeUser({ session }), isNotActiveStudent({ user: submitter }))
    .then(respond({ error: "NOT_FOUND" })),
);
