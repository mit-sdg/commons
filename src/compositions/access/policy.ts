import { view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { FORUM } from "./capabilities.ts";

const { Archiving, Conversing, Locking, Posting, Roling, Rostering, Trashing } = concepts;

export const isArchived = view("(user) is archived", ({ user }, _outputs, _bindings) =>
  where(Archiving._isTrashed({ item: user }).is({ trashed: true })),
).holds();

export const mayModerate = view("(user) may moderate", ({ user }, _outputs, _bindings) => [
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "moderate" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
      present: false,
    }),
  ),
]).holds();

export const mayNotModerate = view("(user) may not moderate", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "moderate" }).is({ allowed: false }),
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({ present: true }),
  ),
).holds();

export const mayAdminister = view("(user) may administer", ({ user }, _outputs, _bindings) => [
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "administer" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({
      present: false,
    }),
  ),
]).holds();

export const mayNotAdminister = view("(user) may not administer", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "administer" }).is({
      allowed: false,
    }),
    Roling._hasCapabilityHolder({ context: FORUM, capability: "administer" }).is({ present: true }),
  ),
).holds();

export const mayManageRoster = view(
  "(user) may manage the roster",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotManageRoster = view(
  "(user) may not manage the roster",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "roster:manage" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayManageAssignments = view(
  "(user) may manage assignments",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "assignments:manage" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotManageAssignments = view(
  "(user) may not manage assignments",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "assignments:manage" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayViewAllSubmissions = view(
  "(user) may view all submissions",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "submissions:view-all" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotViewAllSubmissions = view(
  "(user) may not view all submissions",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "submissions:view-all" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayManageGrades = view("(user) may manage grades", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: FORUM, capability: "grades:manage" }).is({
      allowed: true,
    }),
  ),
).holds();

export const mayNotManageGrades = view(
  "(user) may not manage grades",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "grades:manage" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayViewAllGrades = view(
  "(user) may view all grades",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "grades:view-all" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotViewAllGrades = view(
  "(user) may not view all grades",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "grades:view-all" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayManageLateDays = view(
  "(user) may manage late days",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "late-days:manage" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotManageLateDays = view(
  "(user) may not manage late days",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "late-days:manage" }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayManageStudentNotes = view(
  "(user) may manage student notes",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "student-notes:manage" }).is({
        allowed: true,
      }),
    ),
).holds();

export const mayNotManageStudentNotes = view(
  "(user) may not manage student notes",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: FORUM, capability: "student-notes:manage" }).is({
        allowed: false,
      }),
    ),
).holds();
export const mayViewStaffCalendar = view(
  "(user) may view the staff calendar",
  ({ user }, _outputs, _bindings) => [
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
  ],
).holds();

export const mayNotViewStaffCalendar = view(
  "(user) may not view the staff calendar",
  ({ user }, _outputs, _bindings) =>
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
).holds();
export const mayPinInScope = view(
  "(user) may pin in (scope)",
  ({ user, scope }, _outputs, _bindings) => [
    where(Roling._hasCapability({ user, context: scope, capability: "pin" }).is({ allowed: true })),
    where(Roling._hasCapability({ user, context: FORUM, capability: "pin" }).is({ allowed: true })),
  ],
).holds();

export const mayNotPinInScope = view(
  "(user) may not pin in (scope)",
  ({ user, scope }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: scope, capability: "pin" }).is({ allowed: false }),
      Roling._hasCapability({ user, context: FORUM, capability: "pin" }).is({ allowed: false }),
    ),
).holds();
export const isActiveStudent = view(
  "(user) is an active student",
  ({ user }, _outputs, _bindings) =>
    where(Rostering._isActiveStudent({ user }).is({ active: true })),
).holds();

export const isActiveCourseMember = view(
  "(user) is an active course member",
  ({ user }, _outputs, _bindings) =>
    where(Rostering._getSeatByUser({ user }).is({ status: "ACTIVE" })),
).holds();

export const isNotActiveStudent = view(
  "(user) is not an active student",
  ({ user }, _outputs, _bindings) =>
    where(Rostering._isActiveStudent({ user }).is({ active: false })),
).holds();

export const authored = view("(user) authored (post)", ({ user, post }, _outputs, _bindings) =>
  where(Posting._getPost({ post }).is({ author: user })),
).holds();

export const didNotAuthor = view(
  "(user) did not author (post)",
  ({ user, post }, _outputs, _bindings) =>
    where(Posting._getPost({ post }).is.not({ author: user })),
).holds();

export const mayEditPost = view(
  "(user) may edit (post)",
  ({ user, post }, _outputs, { node, conversation }) =>
    where(
      Posting._getPost({ post }).is({ author: user }),
      Trashing._isTrashed({ item: post }).is({ trashed: false }),
      Conversing._getNodeByItem({ item: post }).is({ node }),
      Conversing._getConversation({ node }).is({ conversation }),
      Locking._isLocked({ target: conversation }).is({ locked: false }),
    ),
).holds();

export const mayNotEditPost = view(
  "(user) may not edit (post)",
  ({ user, post }, _outputs, { node, conversation }) => [
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
).holds();
