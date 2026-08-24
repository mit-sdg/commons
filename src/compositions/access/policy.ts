import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { ADMINISTER, COMMONS } from "./capabilities.ts";

const { Archiving, Conversing, Locking, Posting, Roling, Rostering, Trashing } = concepts;

/**
 * Every capability check passes for a holder of `administer`, so each `may…`
 * view is a disjunction of the capability itself and the wildcard, and each
 * `mayNot…` view is the exact complement. Adding a capability therefore never
 * leaves administrators behind.
 */

export const isArchived = view("(user) is archived", ({ user }, _outputs, _bindings) =>
  where(Archiving._isTrashed({ item: user }).is({ trashed: true })),
).holds();

export const mayAdminister = view("(user) may administer", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({ allowed: true }),
  ),
).holds();

export const mayNotAdminister = view("(user) may not administer", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
      allowed: false,
    }),
  ),
).holds();

export const isSoleAdministrator = view(
  "(user) is the only administrator",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._isSoleCapabilityHolder({ user, context: COMMONS, capability: ADMINISTER }).is({
        sole: true,
      }),
    ),
).holds();

export const isNotSoleAdministrator = view(
  "(user) is not the only administrator",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._isSoleCapabilityHolder({ user, context: COMMONS, capability: ADMINISTER }).is({
        sole: false,
      }),
    ),
).holds();

/**
 * Roling refuses a revocation for an account that holds nothing, so a caller
 * that revokes as one step of a larger act branches on these two first.
 */
export const holdsARole = view(
  "(user) holds a role in (context)",
  ({ user, context }, _outputs, _bindings) => where(Roling._getRole({ user, context })),
).holds();

export const holdsNoRole = view(
  "(user) holds no role in (context)",
  ({ user, context }, _outputs, _bindings) => where(no(Roling._getRole({ user, context }))),
).holds();

export const mayModerate = view("(user) may moderate", ({ user }, _outputs, _bindings) => [
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "moderate" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({ allowed: true }),
  ),
]).holds();

export const mayNotModerate = view("(user) may not moderate", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "moderate" }).is({
      allowed: false,
    }),
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
      allowed: false,
    }),
  ),
).holds();

export const mayManageCourse = view(
  "(user) may manage the course",
  ({ user }, _outputs, _bindings) => [
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "course:manage" }).is({
        allowed: true,
      }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: true,
      }),
    ),
  ],
).holds();

export const mayNotManageCourse = view(
  "(user) may not manage the course",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "course:manage" }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: false,
      }),
    ),
).holds();

export const mayGrade = view("(user) may grade", ({ user }, _outputs, _bindings) => [
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "grade" }).is({ allowed: true }),
  ),
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({ allowed: true }),
  ),
]).holds();

export const mayNotGrade = view("(user) may not grade", ({ user }, _outputs, _bindings) =>
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "grade" }).is({ allowed: false }),
    Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
      allowed: false,
    }),
  ),
).holds();

export const mayManageStudentRecords = view(
  "(user) may manage student records",
  ({ user }, _outputs, _bindings) => [
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "student-records" }).is({
        allowed: true,
      }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: true,
      }),
    ),
  ],
).holds();

export const mayNotManageStudentRecords = view(
  "(user) may not manage student records",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "student-records" }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: false,
      }),
    ),
).holds();

/** The staff calendar is visible to anyone carrying any staff capability. */
export const mayViewStaffCalendar = view(
  "(user) may view the staff calendar",
  ({ user }, _outputs, _bindings) => [
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: true,
      }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "course:manage" }).is({
        allowed: true,
      }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "grade" }).is({ allowed: true }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "student-records" }).is({
        allowed: true,
      }),
    ),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "moderate" }).is({
        allowed: true,
      }),
    ),
  ],
).holds();

export const mayNotViewStaffCalendar = view(
  "(user) may not view the staff calendar",
  ({ user }, _outputs, _bindings) =>
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: ADMINISTER }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: "course:manage" }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: "grade" }).is({ allowed: false }),
      Roling._hasCapability({ user, context: COMMONS, capability: "student-records" }).is({
        allowed: false,
      }),
      Roling._hasCapability({ user, context: COMMONS, capability: "moderate" }).is({
        allowed: false,
      }),
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
