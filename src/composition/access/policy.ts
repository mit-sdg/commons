import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts/index.ts";
import { FORUM } from "./capabilities.ts";

const { Conversing, Locking, Posting, Roling, Rostering, Trashing } = concepts;

export const mayModerate = view("(user) may moderate", ({ user }) => [
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "moderate" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
      present: false,
    }),
  ),
]);

export const mayNotModerate = view("(user) may not moderate", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "moderate" }).is({ allowed: false }),
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({ present: true }),
  ),
);

export const mayAdminister = view("(user) may administer", ({ user }) => [
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "administer" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
      present: false,
    }),
  ),
]);

export const mayNotAdminister = view("(user) may not administer", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "administer" }).is({
      allowed: false,
    }),
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({ present: true }),
  ),
);

export const mayManageRoster = view("(user) may manage the roster", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotManageRoster = view("(user) may not manage the roster", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
      allowed: false,
    }),
  ),
);

export const mayManageAssignments = view("(user) may manage assignments", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "assignments:manage" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotManageAssignments = view("(user) may not manage assignments", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "assignments:manage" }).is({
      allowed: false,
    }),
  ),
);

export const mayViewAllSubmissions = view("(user) may view all submissions", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "submissions:view-all" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotViewAllSubmissions = view("(user) may not view all submissions", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "submissions:view-all" }).is({
      allowed: false,
    }),
  ),
);

export const mayManageGrades = view("(user) may manage grades", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "grades:manage" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotManageGrades = view("(user) may not manage grades", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "grades:manage" }).is({
      allowed: false,
    }),
  ),
);

export const mayViewAllGrades = view("(user) may view all grades", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "grades:view-all" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotViewAllGrades = view("(user) may not view all grades", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "grades:view-all" }).is({
      allowed: false,
    }),
  ),
);

export const mayManageLateDays = view("(user) may manage late days", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "late-days:manage" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotManageLateDays = view("(user) may not manage late days", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "late-days:manage" }).is({
      allowed: false,
    }),
  ),
);

export const mayManageStudentNotes = view("(user) may manage student notes", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "student-notes:manage" }).is({
      allowed: true,
    }),
  ),
);

export const mayNotManageStudentNotes = view("(user) may not manage student notes", ({ user }) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "student-notes:manage" }).is({
      allowed: false,
    }),
  ),
);
export const mayViewStaffCalendar = view("(user) may view the staff calendar", ({ user }) => [
  where(
    Roling._hasCapability({
      user,
      context: FORUM,
      capability: "calendar:view-staff",
    }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
      allowed: true,
    }),
  ),
]);

export const mayNotViewStaffCalendar = view("(user) may not view the staff calendar", ({ user }) =>
  where(
    Roling._hasCapability({
      user,
      context: FORUM,
      capability: "calendar:view-staff",
    }).is({ allowed: false }),
    Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
      allowed: false,
    }),
  ),
);
export const mayPinInScope = view("(user) may pin in (scope)", ({ user, scope }) => [
  where(Roling._hasCapability({ user, context: scope, capability: "pin" }).is({ allowed: true })),
  where(Roling._hasCapability({ user, context: FORUM, capability: "pin" }).is({ allowed: true })),
]);

export const mayNotPinInScope = view("(user) may not pin in (scope)", ({ user, scope }) =>
  where(
    Roling._hasCapability({ user, context: scope, capability: "pin" }).is({ allowed: false }),
    Roling._hasCapability({ user, context: FORUM, capability: "pin" }).is({ allowed: false }),
  ),
);
export const isActiveStudent = view("(user) is an active student", ({ user }) =>
  where(Rostering._isActiveStudent({ user }).is({ active: true })),
);

export const isActiveCourseMember = view("(user) is an active course member", ({ user }) =>
  where(Rostering._getSeatByUser({ user }).is({ status: "ACTIVE" })),
);

export const isNotActiveStudent = view("(user) is not an active student", ({ user }) =>
  where(Rostering._isActiveStudent({ user }).is({ active: false })),
);

export const authored = view("(user) authored (post)", ({ user, post }) =>
  where(Posting._getPost({ post }).is({ author: user })),
);

export const didNotAuthor = view("(user) did not author (post)", ({ user, post }) =>
  where(Posting._getPost({ post }).is.not({ author: user })),
);

export const mayEditPost = view("(user) may edit (post)", ({ user, post, node, conversation }) =>
  where(
    Posting._getPost({ post }).is({ author: user }),
    Trashing._isTrashed({ item: post }).is({ trashed: false }),
    Conversing._getNodeByItem({ item: post }).is({ node }),
    Conversing._getConversation({ node }).is({ conversation }),
    Locking._isLocked({ target: conversation }).is({ locked: false }),
  ),
);

export const mayNotEditPost = view(
  "(user) may not edit (post)",
  ({ user, post, node, conversation }) => [
    where(
      Posting._getPost({ post }).is.not({ author: user }),
      Trashing._isTrashed({ item: post }).is({ trashed: false }),
    ),
    where(
      Posting._getPost({ post }).is({ author: user }),
      Trashing._isTrashed({ item: post }).is({ trashed: false }),
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._getConversation({ node }).is({ conversation }),
      Locking._isLocked({ target: conversation }).is({ locked: true }),
    ),
  ],
);
