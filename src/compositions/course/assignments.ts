import { activeUser } from "../access/session.ts";
import { each, former, is, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageAssignments,
  mayNotManageAssignments,
} from "../access/policy.ts";
import { concepts } from "../../vocabulary.ts";

const { Assigning, Itemizing, Posting, Rostering, Submitting, Timing } = concepts;
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
      Timing._now({}).is({ at }),
      Assigning._getPublishedForAudience({ audience: section }).is({ assignment }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
    )
    .then(Assigning.assign({ assignment, assignee: user, at })),
);
export const ReinstatedStudentSeatReceivesPublished = reaction(
  ({ user, section, assignment, at }) =>
    when(Rostering.reinstateSeat({}).responds({ kind: "STUDENT", user, section }))
      .where(
        Timing._now({}).is({ at }),
        Assigning._getPublishedForAudience({ audience: section }).is({ assignment }),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
      )
      .then(Assigning.assign({ assignment, assignee: user, at })),
);
export const PublishedAcceptingAssignmentGetsGradeItem = reaction(({ assignment, title }) =>
  when(Assigning.publish({}).responds({ assignment, acceptsSubmissions: true }))
    .where(Assigning._getAssignments({}).is({ assignment, title }))
    .then(Itemizing.ensureItem({ item: assignment, label: title, maxPoints: 100 })),
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
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
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
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
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
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
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
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
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
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
        .then(Assigning.publish({ assignment, at }).responds({ assignment: published }))
        .then(respond({ assignment: published }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const Archive = endpoint(
  "/assignments/archive",
  ({ session, assignment, user, at, archived }) =>
    receive({ session, assignment }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
        .then(Assigning.archive({ assignment, at }).responds({ assignment: archived }))
        .then(respond({ assignment: archived }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
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

export const GetAssignment = endpoint("/assignments/get", ({ session, assignment, user, detail }) =>
  receive({ session, assignment }).then(
    where(
      activeUser({ session }).is({ user }),
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
      Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }),
      theAssignment({ assignment }).is({ detail }),
    )
      .then(respond({ assignment: detail }))
      .named("found"),
    where(
      activeUser({ session }).is({ user }),
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
    )
      .then(respond({ assignment: null }))
      .named("not-assigned"),
    where(
      activeUser({ session }).is({ user }),
      isActiveStudent({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
      no(Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" })),
    )
      .then(respond({ assignment: null }))
      .named("not-published"),
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
        mayManageAssignments({ user }),
        theAssignment({ assignment }).is({ detail }),
      )
        .then(respond({ summary: detail }))
        .named("found"),
      where(
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
        no(theAssignment({ assignment })),
      )
        .then(respond({ summary: null }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const StaffList = endpoint("/assignments/staff-list", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
      .then(respond({ assignments: theStaffAssignments({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const SetDueOverride = endpoint(
  "/assignments/set-due-override",
  ({ session, assignment, assignee, dueAt, user, release }) =>
    receive({ session, assignment, assignee, dueAt }).then(
      where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
        .then(Assigning.setDueOverride({ assignment, assignee, dueAt }).responds({ release }))
        .then(respond({ release }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ClearDueOverride = endpoint(
  "/assignments/clear-due-override",
  ({ session, assignment, assignee, user, release }) =>
    receive({ session, assignment, assignee }).then(
      where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
        .then(Assigning.clearDueOverride({ assignment, assignee }).responds({ release }))
        .then(respond({ release }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const Submit = endpoint(
  "/assignments/submit",
  ({ session, assignment, content, user, at, post, submission }) =>
    receive({ session, assignment, content }).then(
      where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
      )
        .then(Posting.create({ author: user, content, at }).responds({ post }))
        .then(
          Submitting.submit({ assignment, submitter: user, artifact: post, at }).responds({
            submission,
          }),
        )
        .then(respond({ submission }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);
