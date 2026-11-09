import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { ADMINISTER, COMMONS } from "./capabilities.ts";

const { Archiving, Conversing, Delegating, Locking, Posting, Roling, Rostering, Trashing } =
  concepts;

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

/** Lecture attendance is visible to anyone carrying a staff capability or `live:host`. */
export const mayViewAttendance = view(
  "(user) may view lecture attendance",
  ({ user }, _outputs, _bindings) => [
    where(mayViewStaffCalendar({ user })),
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
        allowed: true,
      }),
    ),
  ],
).holds();

export const mayNotViewAttendance = view(
  "(user) may not view lecture attendance",
  ({ user }, _outputs, _bindings) =>
    where(
      mayNotViewStaffCalendar({ user }),
      Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
        allowed: false,
      }),
    ),
).holds();

/** The attendance grid names every student, so an active student is refused it. */
export const mayReadAttendance = view(
  "(user) may read the attendance grid",
  ({ user }, _outputs, _bindings) =>
    where(mayViewAttendance({ user }), isNotActiveStudent({ user })),
).holds();

export const mayNotReadAttendance = view(
  "(user) may not read the attendance grid",
  ({ user }, _outputs, _bindings) => [
    where(mayNotViewAttendance({ user })),
    where(isActiveStudent({ user })),
  ],
).holds();

/** Marking a run as a lecture needs `live:host` or `course:manage`. */
export const mayMarkLectures = view("(user) may mark lectures", ({ user }, _outputs, _bindings) => [
  where(mayManageCourse({ user })),
  where(
    Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
      allowed: true,
    }),
  ),
]).holds();

export const mayNotMarkLectures = view(
  "(user) may not mark lectures",
  ({ user }, _outputs, _bindings) =>
    where(
      mayNotManageCourse({ user }),
      Roling._hasCapability({ user, context: COMMONS, capability: "live:host" }).is({
        allowed: false,
      }),
    ),
).holds();

/**
 * The gradebook and course grades show every student's ratings, averages, and
 * ranks, and releasing an item or choosing who grades whom acts on every
 * student's work, so a caller holding `grade` does these only while not
 * enrolled as an active student.
 */
export const mayReadClassGrades = view(
  "(user) may read the class's grades",
  ({ user }, _outputs, _bindings) => where(mayGrade({ user }), isNotActiveStudent({ user })),
).holds();

export const mayNotReadClassGrades = view(
  "(user) may not read the class's grades",
  ({ user }, _outputs, _bindings) => [
    where(mayNotGrade({ user })),
    where(isActiveStudent({ user })),
  ],
).holds();

/**
 * A grader who is also an active student sees and grades a classmate's work on
 * an item only when Delegating names them that classmate's grader there, and
 * never their own work.
 */
export const mayGradeWork = view(
  "(user) may grade the work of (learner) on (item)",
  ({ user, learner, item }, _outputs, _bindings) => [
    where(mayGrade({ user }), isNotActiveStudent({ user })),
    where(
      mayGrade({ user }),
      isActiveStudent({ user }),
      Delegating._getDelegation({ item, subject: learner })
        .is({ delegate: user })
        .is.not({ delegate: learner }),
    ),
  ],
).holds();

export const mayNotGradeWork = view(
  "(user) may not grade the work of (learner) on (item)",
  ({ user, learner, item }, _outputs, _bindings) => [
    where(mayNotGrade({ user })),
    where(
      isActiveStudent({ user }),
      no(Delegating._getDelegation({ item, subject: learner }).is({ delegate: user })),
    ),
    where(
      isActiveStudent({ user }),
      Delegating._getDelegation({ item, subject: learner })
        .is({ delegate: user })
        .is({ delegate: learner }),
    ),
  ],
).holds();

/**
 * Changing policies, overrides, and releases, and downloading, needs
 * `grade-policies` on top of reading the class's grades.
 */
export const mayChangeCourseGrades = view(
  "(user) may change course grades",
  ({ user }, _outputs, _bindings) => [
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "grade-policies" }).is({
        allowed: true,
      }),
      mayReadClassGrades({ user }),
    ),
    where(mayAdminister({ user }), isNotActiveStudent({ user })),
  ],
).holds();

export const mayNotChangeCourseGrades = view(
  "(user) may not change course grades",
  ({ user }, _outputs, _bindings) => [
    where(
      Roling._hasCapability({ user, context: COMMONS, capability: "grade-policies" }).is({
        allowed: false,
      }),
      mayNotAdminister({ user }),
    ),
    where(mayNotReadClassGrades({ user })),
  ],
).holds();
