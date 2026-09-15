import { activeUser } from "../access/session.ts";
import {
  compute,
  each,
  former,
  is,
  no,
  reaction,
  view,
  when,
  where,
  now,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayGrade,
  mayNotGrade,
  mayManageCourse,
  mayNotManageCourse,
} from "../access/policy.ts";
import { concepts, computations as c } from "../../concepts.ts";

const { Assigning, Grading, Notifying, Posting, Rostering, Submitting } = concepts;
/** Which assignments belong to this learner? */
export const theAssignmentsOf = former(
  "the assignments of (student)",
  ({ student }, { assignment, release, dueOverride, releaseStatus }) =>
    each(
      Assigning._getAssigned({ assignee: student }).is({
        assignment,
        release,
        dueOverride,
        status: releaseStatus,
      }),
    )
      .where(Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }))
      .form({ assignment, release, dueOverride, status: releaseStatus }),
);
/** What is this assignment? */
export const theAssignment = view(
  "the assignment (assignment)",
  ({ assignment }, { detail }, _bindings) =>
    where(Assigning._getDetail({ assignment }).is({ detail })),
).optional();

/** Which assignments can staff manage? */
export const theStaffAssignments = former(
  "the staff assignments ()",
  (
    _inputs,
    {
      assignment,
      author,
      title,
      instructions,
      kind,
      availableAt,
      dueAt,
      closeAt,
      acceptsSubmissions,
      audience,
      targets,
      status,
      createdAt,
      updatedAt,
    },
  ) =>
    each(
      Assigning._getAssignments({}).is({
        assignment,
        author,
        title,
        instructions,
        kind,
        availableAt,
        dueAt,
        closeAt,
        acceptsSubmissions,
        audience,
        targets,
        status,
        createdAt,
        updatedAt,
      }),
    ).form({
      assignment,
      author,
      title,
      instructions,
      kind,
      availableAt,
      dueAt,
      closeAt,
      acceptsSubmissions,
      audience,
      targets,
      status,
      createdAt,
      updatedAt,
    }),
);

export const PublishedAssignmentAssignsAudienceStudents = reaction(
  ({ assignment, audience, targets, user, section, at }) =>
    when(Assigning.publish({ at }).responds({ assignment, audience, targets })).then(
      where(is.among(audience, ["EVERYONE"]), Rostering._getActiveStudents({}).is({ user }))
        .then(Assigning.assign({ assignment, assignee: user, at }))
        .named("everyone"),
      where(
        is.among(audience, ["TARGETS"]),
        Rostering._getActiveStudents({}).is({ user, section }),
        is.among(section, targets),
      )
        .then(Assigning.assign({ assignment, assignee: user, at }))
        .named("targets"),
    ),
);

export const RevisedAssignmentAssignsNewAudienceStudents = reaction(
  ({ assignment, status, audience, targets, user, section, at }) =>
    when(Assigning.revise({ at }).responds({ assignment, status, audience, targets })).then(
      where(
        is.among(status, ["PUBLISHED"]),
        is.among(audience, ["EVERYONE"]),
        Rostering._getActiveStudents({}).is({ user }),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
      )
        .then(Assigning.assign({ assignment, assignee: user, at }))
        .named("everyone"),
      where(
        is.among(status, ["PUBLISHED"]),
        is.among(audience, ["TARGETS"]),
        Rostering._getActiveStudents({}).is({ user, section }),
        is.among(section, targets),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
      )
        .then(Assigning.assign({ assignment, assignee: user, at }))
        .named("targets"),
    ),
);
export const ClaimedStudentSeatReceivesPublished = reaction(({ user, section, assignment, at }) =>
  when(Rostering.claimSeat({}).responds({ kind: "STUDENT", user, section }))
    .where(
      now(at),
      Assigning._getPublishedForAudience({ audience: section }).is({ assignment }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
    )
    .then(Assigning.assign({ assignment, assignee: user, at })),
);
export const ReinstatedStudentSeatReceivesPublished = reaction(
  ({ user, section, assignment, at }) =>
    when(Rostering.reinstateSeat({}).responds({ kind: "STUDENT", user, section }))
      .where(
        now(at),
        Assigning._getPublishedForAudience({ audience: section }).is({ assignment }),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
      )
      .then(Assigning.assign({ assignment, assignee: user, at })),
);
export const CreateDraft = endpoint(
  "/assignments/create-draft",
  ({
    session,
    title,
    instructions,
    kind,
    availableAt,
    dueAt,
    closeAt,
    acceptsSubmissions,
    audience,
    targets,
    user,
    at,
    assignment,
  }) =>
    receive({
      session,
      title,
      instructions,
      kind,
      availableAt,
      dueAt,
      closeAt,
      acceptsSubmissions,
      audience,
      targets,
    }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(
          Assigning.createDraft({
            author: user,
            title,
            instructions,
            kind,
            availableAt,
            dueAt,
            closeAt,
            acceptsSubmissions,
            audience,
            targets,
            at,
          }).responds({ assignment }),
        )
        .then(respond({ assignment }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: [
        "session",
        "title",
        "instructions",
        "kind",
        "availableAt",
        "dueAt",
        "acceptsSubmissions",
        "audience",
      ],
      defaults: { closeAt: null, targets: [] },
    },
  },
);

export const Revise = endpoint(
  "/assignments/revise",
  ({
    session,
    assignment,
    title,
    instructions,
    kind,
    availableAt,
    dueAt,
    closeAt,
    acceptsSubmissions,
    audience,
    targets,
    user,
    at,
    revised,
  }) =>
    receive({
      session,
      assignment,
      title,
      instructions,
      kind,
      availableAt,
      dueAt,
      closeAt,
      acceptsSubmissions,
      audience,
      targets,
    }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(
          Assigning.revise({
            assignment,
            title,
            instructions,
            kind,
            availableAt,
            dueAt,
            closeAt,
            acceptsSubmissions,
            audience,
            targets,
            at,
          }).responds({ assignment: revised }),
        )
        .then(respond({ assignment: revised }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: [
        "session",
        "assignment",
        "title",
        "instructions",
        "kind",
        "availableAt",
        "dueAt",
        "acceptsSubmissions",
        "audience",
      ],
      defaults: { closeAt: null, targets: [] },
    },
  },
);

export const Publish = endpoint(
  "/assignments/publish",
  ({ session, assignment, user, at, published }) =>
    receive({ session, assignment }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Assigning.publish({ assignment, at }).responds({ assignment: published }))
        .then(respond({ assignment: published }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const Archive = endpoint(
  "/assignments/archive",
  ({ session, assignment, user, at, archived }) =>
    receive({ session, assignment }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Assigning.archive({ assignment, at }).responds({ assignment: archived }))
        .then(respond({ assignment: archived }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ForMe = endpoint("/assignments/for-me", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ assignments: theAssignmentsOf({ student: user }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const mayReadLearnerAssignment = view(
  "(user) may read learner assignment (assignment)",
  ({ user, assignment }, _outputs, { status }) => [
    where(
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
      Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }),
    ),
    where(
      isActiveStudent({ user }),
      Assigning._getAssignments({}).is({ assignment, status: "ARCHIVED" }),
      Grading._getGradesForLearner({ learner: user }).is({ item: assignment, status }),
      is.among(status, ["RELEASED", "EXCUSED"]),
    ),
  ],
).holds();

export const mayReadStaffAssignment = view(
  "(user) may read staff assignment details",
  ({ user }, _outputs, _bindings) => [where(mayManageCourse({ user })), where(mayGrade({ user }))],
).holds();

export const GetAssignment = endpoint(
  "/assignments/get",
  ({ session, assignment, user, detail, section, at, canSubmit }) =>
    receive({ session, assignment }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadLearnerAssignment({ user, assignment }),
        theAssignment({ assignment }).is({ detail }),
        Rostering._getSeatByUser({ user }).is({ section }),
        now(at),
        compute(c.submissionAllowed, { detail, section, at }, canSubmit),
      )
        .then(respond({ assignment: detail, canSubmit }))
        .named("found"),
      where(
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
        no(mayReadLearnerAssignment({ user, assignment })),
      )
        .then(respond({ assignment: null, canSubmit: false }))
        .named("unavailable"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const StaffSummary = endpoint(
  "/assignments/staff-summary",
  ({ session, assignment, user, detail }) =>
    receive({ session, assignment }).then(
      where(
        activeUser({ session }).is({ user }),
        mayReadStaffAssignment({ user }),
        theAssignment({ assignment }).is({ detail }),
      )
        .then(respond({ summary: detail }))
        .named("found"),
      where(
        activeUser({ session }).is({ user }),
        mayReadStaffAssignment({ user }),
        no(theAssignment({ assignment })),
      )
        .then(respond({ summary: null }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user }),
        mayNotManageCourse({ user }),
        mayNotGrade({ user }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const StaffList = endpoint("/assignments/staff-list", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(respond({ assignments: theStaffAssignments({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const SetDueOverride = endpoint(
  "/assignments/set-due-override",
  ({ session, assignment, assignee, dueAt, user, release }) =>
    receive({ session, assignment, assignee, dueAt }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Assigning.setDueOverride({ assignment, assignee, dueAt }).responds({ release }))
        .then(respond({ release }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ClearDueOverride = endpoint(
  "/assignments/clear-due-override",
  ({ session, assignment, assignee, user, release }) =>
    receive({ session, assignment, assignee }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Assigning.clearDueOverride({ assignment, assignee }).responds({ release }))
        .then(respond({ release }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const maySubmitAssignment = view(
  "(user) may submit assignment (assignment) at (at)",
  ({ user, assignment, at }, _outputs, { detail, section, allowed }) =>
    where(
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
      Assigning._getDetail({ assignment }).is({ detail }),
      Rostering._getSeatByUser({ user }).is({ section }),
      compute(c.submissionAllowed, { detail, section, at }, allowed),
      is.among(allowed, [true]),
    ),
).holds();

export const Submit = endpoint(
  "/assignments/submit",
  ({ session, assignment, content, user, at, post, submission }) =>
    receive({ session, assignment, content }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        maySubmitAssignment({ user, assignment, at }),
      )
        .then(Posting.create({ author: user, content, at }).responds({ post }))
        .then(
          Submitting.submit({ assignment, submitter: user, artifact: post, at }).responds({
            submission,
          }),
        )
        .then(respond({ submission }))
        .named("success"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        no(maySubmitAssignment({ user, assignment, at })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unavailable"),
    ),
);

/** Notify each actual release, including targeted publication and later enrolment. */
export const AssignmentReleaseNotifiesStudent = reaction(({ assignment, assignee, at }) =>
  when(Assigning.assign({ assignment, assignee, at }).responds())
    .where(
      isActiveStudent({ user: assignee }),
      Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }),
    )
    .then(
      Notifying.notify({
        recipient: assignee,
        kind: "assignment_released",
        subject: assignment,
        link: assignment,
        actor: null,
        at,
      }),
    ),
);
