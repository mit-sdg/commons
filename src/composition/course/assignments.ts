import { activeUser } from "../access/session.ts";
import { each, former, is, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageAssignments,
  mayNotManageAssignments,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Assigning, Itemizing, Posting, Rostering, Submitting, Timing } = concepts;
/** Which assignments belong to this learner? */
export const theAssignmentsOf = former(
  "the assignments of (student)",
  ({ student }, { assignment, release, dueOverride, status }) =>
    each(
      Assigning._getAssigned({ assignee: student }).is({
        assignment,
        release,
        dueOverride,
        status,
      }),
    ).form({ assignment, release, dueOverride, status }),
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

export const PublishToEveryoneAssignsActiveStudents = reaction(({ assignment, user, at }) =>
  when(Assigning.publish({ at }).responds({ assignment, audience: "EVERYONE" }))
    .where(Rostering._getActiveStudents({}).is({ user }))
    .then(Assigning.assign({ assignment, assignee: user, at })),
);

export const PublishToTargetsAssignsSectionStudents = reaction(
  ({ assignment, targets, user, section, at }) =>
    when(Assigning.publish({ at }).responds({ assignment, audience: "TARGETS", targets }))
      .where(Rostering._getActiveStudents({}).is({ user, section }), is.among(section, targets))
      .then(Assigning.assign({ assignment, assignee: user, at })),
);
export const WidenedEveryoneAssignsActiveStudents = reaction(({ assignment, user, at }) =>
  when(Assigning.revise({ at }).responds({ assignment, status: "PUBLISHED", audience: "EVERYONE" }))
    .where(
      Rostering._getActiveStudents({}).is({ user }),
      Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
    )
    .then(Assigning.assign({ assignment, assignee: user, at })),
);

export const WidenedTargetsAssignSectionStudents = reaction(
  ({ assignment, targets, user, section, at }) =>
    when(
      Assigning.revise({ at }).responds({
        assignment,
        status: "PUBLISHED",
        audience: "TARGETS",
        targets,
      }),
    )
      .where(
        Rostering._getActiveStudents({}).is({ user, section }),
        is.among(section, targets),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: false }),
      )
      .then(Assigning.assign({ assignment, assignee: user, at })),
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
    })
      .where(
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
      .then(respond({ assignment })),
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

export const CreateDraftForbidden = endpoint(
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
    })
      .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" })),
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
    })
      .where(
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
      .then(respond({ assignment: revised })),
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

export const ReviseForbidden = endpoint(
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
    })
      .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const Publish = endpoint(
  "/assignments/publish",
  ({ session, assignment, user, at, published }) =>
    receive({ session, assignment })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
      .then(Assigning.publish({ assignment, at }).responds({ assignment: published }))
      .then(respond({ assignment: published })),
);

export const PublishForbidden = endpoint("/assignments/publish", ({ session, assignment, user }) =>
  receive({ session, assignment })
    .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const Archive = endpoint(
  "/assignments/archive",
  ({ session, assignment, user, at, archived }) =>
    receive({ session, assignment })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageAssignments({ user }),
      )
      .then(Assigning.archive({ assignment, at }).responds({ assignment: archived }))
      .then(respond({ assignment: archived })),
);

export const ArchiveForbidden = endpoint("/assignments/archive", ({ session, assignment, user }) =>
  receive({ session, assignment })
    .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const ForMe = endpoint("/assignments/for-me", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
    .then(respond({ assignments: theAssignmentsOf({ student: user }) })),
);
export const ForMeForbidden = endpoint("/assignments/for-me", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const GetAssignment = endpoint("/assignments/get", ({ assignment, detail }) =>
  receive({ assignment }).then(
    where(theAssignment({ assignment }).is({ detail }))
      .then(respond({ assignment: detail }))
      .named("case-1"),
    where(no(theAssignment({ assignment })))
      .then(respond({ assignment: null }))
      .named("case-2"),
  ),
);

export const StaffSummary = endpoint(
  "/assignments/staff-summary",
  ({ session, assignment, user, detail }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
      .then(
        where(theAssignment({ assignment }).is({ detail }))
          .then(respond({ summary: detail }))
          .named("case-1"),
        where(no(theAssignment({ assignment })))
          .then(respond({ summary: null }))
          .named("case-2"),
      ),
);

export const StaffSummaryForbidden = endpoint(
  "/assignments/staff-summary",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const StaffList = endpoint("/assignments/staff-list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
    .then(respond({ assignments: theStaffAssignments({}) })),
);

export const StaffListForbidden = endpoint("/assignments/staff-list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const SetDueOverride = endpoint(
  "/assignments/set-due-override",
  ({ session, assignment, assignee, dueAt, user, release }) =>
    receive({ session, assignment, assignee, dueAt })
      .where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
      .then(Assigning.setDueOverride({ assignment, assignee, dueAt }).responds({ release }))
      .then(respond({ release })),
);

export const SetDueOverrideForbidden = endpoint(
  "/assignments/set-due-override",
  ({ session, assignment, assignee, dueAt, user }) =>
    receive({ session, assignment, assignee, dueAt })
      .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const ClearDueOverride = endpoint(
  "/assignments/clear-due-override",
  ({ session, assignment, assignee, user, release }) =>
    receive({ session, assignment, assignee })
      .where(activeUser({ session }).is({ user }), mayManageAssignments({ user }))
      .then(Assigning.clearDueOverride({ assignment, assignee }).responds({ release }))
      .then(respond({ release })),
);

export const ClearDueOverrideForbidden = endpoint(
  "/assignments/clear-due-override",
  ({ session, assignment, assignee, user }) =>
    receive({ session, assignment, assignee })
      .where(activeUser({ session }).is({ user }), mayNotManageAssignments({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const Submit = endpoint(
  "/assignments/submit",
  ({ session, assignment, content, user, at, post, submission }) =>
    receive({ session, assignment, content })
      .where(
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
      .then(respond({ submission })),
);

export const SubmitForbidden = endpoint(
  "/assignments/submit",
  ({ session, assignment, content, user }) =>
    receive({ session, assignment, content })
      .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
