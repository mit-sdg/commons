import { activeUser } from "../access/session.ts";
import { each, former, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageStudentRecords,
  mayNotManageStudentRecords,
} from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

const { Assigning, Banking } = concepts;
/** What late-day balance does this learner have? */
export const theLateDayBalanceOf = former(
  "the late-day balance of (learner)",
  ({ learner }, { granted, used, remaining }) =>
    where(Banking._getBalance({ learner }).is({ granted, used, remaining })).form({
      granted,
      used,
      remaining,
    }),
);
/** Which late-day uses belong to this assignment? */
export const theLateDayUsesOn = former(
  "the late-day uses on (assignment)",
  ({ assignment }, { learner, days }) =>
    each(Banking._getUsesForItem({ item: assignment }).is({ learner, days })).form({
      learner,
      days,
    }),
);
/** Which late-day uses belong to this learner? */
export const theLateDayUsesOf = former(
  "the late-day uses of (learner)",
  ({ learner }, { use, item, days, status, appliedAt }) =>
    each(Banking._getUses({ learner }).is({ use, item, days, status, appliedAt })).form({
      use,
      item,
      days,
      status,
      appliedAt,
    }),
);

export const Policy = endpoint(
  "/late-days/policy",
  ({ session, user, defaultDays, maxDaysPerItem, unitHours }) =>
    receive({ session }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageStudentRecords({ user }),
        Banking._getTerms({}).is({
          allowance: defaultDays,
          perItemLimit: maxDaysPerItem,
          unitHours,
        }),
      )
        .then(respond({ defaultDays, maxDaysPerItem, unitHours }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ConfigurePolicy = endpoint(
  "/late-days/configure-policy",
  ({ session, defaultDays, unitHours, maxDaysPerItem, user }) =>
    receive({ session, defaultDays, unitHours, maxDaysPerItem }).then(
      where(activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(
          Banking.setTerms({
            allowance: defaultDays,
            perItemLimit: maxDaysPerItem,
            unitHours,
          }),
        )
        .then(respond({ policy: true }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "defaultDays", "unitHours", "maxDaysPerItem"] } },
);

export const Grant = endpoint(
  "/late-days/grant",
  ({ session, learner, days, reason, user, at, grant }) =>
    receive({ session, learner, days, reason }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(Banking.grant({ learner, days, reason, at }).responds({ grant }))
        .then(respond({ grant }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "learner", "days", "reason"] } },
);

export const Apply = endpoint(
  "/late-days/apply",
  ({ session, assignment, days, user, at, use }) =>
    receive({ session, assignment, days }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
        Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }),
      )
        .then(Banking.apply({ learner: user, item: assignment, days, at }).responds({ use }))
        .then(respond({ use }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "assignment", "days"] } },
);

export const Change = endpoint(
  "/late-days/change",
  ({ session, assignment, days, user, use }) =>
    receive({ session, assignment, days }).then(
      where(
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
        Assigning._isAssigned({ assignment, assignee: user }).is({ assigned: true }),
        Assigning._getAssignments({}).is({ assignment, status: "PUBLISHED" }),
      )
        .then(Banking.change({ learner: user, item: assignment, days }).responds({ use }))
        .then(respond({ use }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "assignment", "days"] } },
);

export const Cancel = endpoint(
  "/late-days/cancel",
  ({ session, assignment, user, use }) =>
    receive({ session, assignment }).then(
      where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
        .then(Banking.cancel({ learner: user, item: assignment }).responds({ use }))
        .then(respond({ use }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "assignment"] } },
);

export const List = endpoint(
  "/late-days/list",
  ({ session, user, unitHours, maxDaysPerItem }) =>
    receive({ session }).then(
      where(
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
        Banking._getTerms({}).is({ unitHours, perItemLimit: maxDaysPerItem }),
      )
        .then(
          respond({
            uses: theLateDayUsesOf({ learner: user }),
            unitHours,
            maxDaysPerItem,
          }),
        )
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session"] } },
);

export const Balance = endpoint(
  "/late-days/balance",
  ({ session, learner, user }) =>
    receive({ session, learner }).then(
      where(activeUser({ session }).is({ user: learner }), isActiveStudent({ user: learner }))
        .then(respond({ balance: theLateDayBalanceOf({ learner }) }))
        .named("balance"),
      where(
        activeUser({ session }).is({ user }),
        mayManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(respond({ balance: theLateDayBalanceOf({ learner }) }))
        .named("staff-balance"),
      where(
        activeUser({ session }).is({ user }).is.not({ user: learner }),
        mayNotManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("balance-unauthorized"),
      where(activeUser({ session }), isNotActiveStudent({ user: learner }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("balance-missing"),
    ),
  { input: { required: ["session", "learner"] } },
);

export const StaffChange = endpoint(
  "/late-days/staff-change",
  ({ session, learner, assignment, days, user, use }) =>
    receive({ session, learner, assignment, days }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(Banking.change({ learner, item: assignment, days }).responds({ use }))
        .then(respond({ use }))
        .named("success"),
      where(activeUser({ session }), isNotActiveStudent({ user: learner }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayNotManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unauthorized"),
    ),
  { input: { required: ["session", "learner", "assignment", "days"] } },
);

export const StaffCancel = endpoint(
  "/late-days/staff-cancel",
  ({ session, learner, assignment, user, use }) =>
    receive({ session, learner, assignment }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(Banking.cancel({ learner, item: assignment }).responds({ use }))
        .then(respond({ use }))
        .named("success"),
      where(activeUser({ session }), isNotActiveStudent({ user: learner }))
        .then(respond({ error: "NOT_FOUND" }))
        .named("hidden"),
      where(
        activeUser({ session }).is({ user }),
        mayNotManageStudentRecords({ user }),
        isActiveStudent({ user: learner }),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("unauthorized"),
    ),
  { input: { required: ["session", "learner", "assignment"] } },
);

export const ForAssignment = endpoint(
  "/late-days/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment }).then(
      where(activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(respond({ users: theLateDayUsesOn({ assignment }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "assignment"] } },
);
