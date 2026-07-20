import { activeUser } from "../access/session.ts";
import { each, former, request, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageLateDays,
  mayNotManageLateDays,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Banking, Timing } = concepts;
/** What late-day balance does this learner have? */
export const theLateDayBalanceOf = former(
  "the late-day balance of (learner)",
  ({ learner, granted, used, remaining }) =>
    where(Banking._getBalance({ learner }).is({ granted, used, remaining })).form({
      granted,
      used,
      remaining,
    }),
);
/** Which late-day uses belong to this assignment? */
export const theLateDayUsesOn = former(
  "the late-day uses on (assignment)",
  ({ assignment, learner, days }) =>
    each(Banking._getUsesForItem({ item: assignment }).is({ learner, days })).form({
      learner,
      days,
    }),
);
/** Which late-day uses belong to this learner? */
export const theLateDayUsesOf = former(
  "the late-day uses of (learner)",
  ({ learner, use, item, days, status, appliedAt }) =>
    each(Banking._getUses({ learner }).is({ use, item, days, status, appliedAt })).form({
      use,
      item,
      days,
      status,
      appliedAt,
    }),
);

export const ConfigurePolicy = endpoint(
  "/late-days/configure-policy",
  ({ session, defaultDays, unitHours, maxDaysPerItem, user }) =>
    receive({ session, defaultDays, unitHours, maxDaysPerItem })
      .where(activeUser({ session }).is({ user }), mayManageLateDays({ user }))
      .then(
        request(Banking.setTerms, {
          allowance: defaultDays,
          perItemLimit: maxDaysPerItem,
          unitHours,
        }),
        respond({ policy: true }),
      ),
  { input: { required: ["session", "defaultDays", "unitHours", "maxDaysPerItem"] } },
);

export const ConfigurePolicyForbidden = endpoint(
  "/late-days/configure-policy",
  ({ session, defaultDays, unitHours, maxDaysPerItem, user }) =>
    receive({ session, defaultDays, unitHours, maxDaysPerItem })
      .where(activeUser({ session }).is({ user }), mayNotManageLateDays({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const Grant = endpoint(
  "/late-days/grant",
  ({ session, learner, days, reason, user, at, grant }) =>
    receive({ session, learner, days, reason })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageLateDays({ user }),
      )
      .then(request(Banking.grant, { learner, days, reason, at }, { grant }), respond({ grant })),
  { input: { required: ["session", "learner", "days", "reason"] } },
);

export const GrantForbidden = endpoint(
  "/late-days/grant",
  ({ session, learner, days, reason, user }) =>
    receive({ session, learner, days, reason })
      .where(activeUser({ session }).is({ user }), mayNotManageLateDays({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const Apply = endpoint(
  "/late-days/apply",
  ({ session, assignment, days, user, at, use }) =>
    receive({ session, assignment, days })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
      )
      .then(
        request(Banking.apply, { learner: user, item: assignment, days, at }, { use }),
        respond({ use }),
      ),
  { input: { required: ["session", "assignment", "days"] } },
);

export const ApplyForbidden = endpoint("/late-days/apply", ({ session, assignment, days, user }) =>
  receive({ session, assignment, days })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const Change = endpoint(
  "/late-days/change",
  ({ session, assignment, days, user, use }) =>
    receive({ session, assignment, days })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(
        request(Banking.change, { learner: user, item: assignment, days }, { use }),
        respond({ use }),
      ),
  { input: { required: ["session", "assignment", "days"] } },
);

export const ChangeForbidden = endpoint(
  "/late-days/change",
  ({ session, assignment, days, user }) =>
    receive({ session, assignment, days })
      .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const Cancel = endpoint(
  "/late-days/cancel",
  ({ session, assignment, user, use }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(
        request(Banking.cancel, { learner: user, item: assignment }, { use }),
        respond({ use }),
      ),
  { input: { required: ["session", "assignment"] } },
);

export const CancelForbidden = endpoint("/late-days/cancel", ({ session, assignment, user }) =>
  receive({ session, assignment })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const List = endpoint(
  "/late-days/list",
  ({ session, user }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ uses: theLateDayUsesOf(user) })),
  { input: { required: ["session"] } },
);

export const ListForbidden = endpoint("/late-days/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const Balance = endpoint(
  "/late-days/balance",
  ({ session, learner }) =>
    receive({ session, learner })
      .where(activeUser({ session }).is({ user: learner }), isActiveStudent({ user: learner }))
      .then(respond({ balance: theLateDayBalanceOf(learner) })),
  { input: { required: ["session", "learner"] } },
);

export const StaffBalance = endpoint("/late-days/balance", ({ session, learner, user }) =>
  receive({ session, learner })
    .where(
      activeUser({ session }).is({ user }),
      mayManageLateDays({ user }),
      isActiveStudent({ user: learner }),
    )
    .then(respond({ balance: theLateDayBalanceOf(learner) })),
);

export const BalanceUnauthorized = endpoint("/late-days/balance", ({ session, learner, user }) =>
  receive({ session, learner })
    .where(
      activeUser({ session }).is({ user }).is.not({ user: learner }),
      mayNotManageLateDays({ user }),
      isActiveStudent({ user: learner }),
    )
    .then(respond({ error: "NOT_FOUND" })),
);

export const BalanceMissing = endpoint("/late-days/balance", ({ session, learner }) =>
  receive({ session, learner })
    .where(activeUser({ session }), isNotActiveStudent({ user: learner }))
    .then(respond({ error: "NOT_FOUND" })),
);

export const StaffChange = endpoint(
  "/late-days/staff-change",
  ({ session, learner, assignment, days, user, use }) =>
    receive({ session, learner, assignment, days })
      .where(
        activeUser({ session }).is({ user }),
        mayManageLateDays({ user }),
        isActiveStudent({ user: learner }),
      )
      .then(
        request(Banking.change, { learner, item: assignment, days }, { use }),
        respond({ use }),
      ),
  { input: { required: ["session", "learner", "assignment", "days"] } },
);

export const StaffCancel = endpoint(
  "/late-days/staff-cancel",
  ({ session, learner, assignment, user, use }) =>
    receive({ session, learner, assignment })
      .where(
        activeUser({ session }).is({ user }),
        mayManageLateDays({ user }),
        isActiveStudent({ user: learner }),
      )
      .then(request(Banking.cancel, { learner, item: assignment }, { use }), respond({ use })),
  { input: { required: ["session", "learner", "assignment"] } },
);

export const StaffChangeHidden = endpoint(
  "/late-days/staff-change",
  ({ session, learner, assignment, days }) =>
    receive({ session, learner, assignment, days })
      .where(activeUser({ session }), isNotActiveStudent({ user: learner }))
      .then(respond({ error: "NOT_FOUND" })),
);

export const StaffCancelHidden = endpoint(
  "/late-days/staff-cancel",
  ({ session, learner, assignment }) =>
    receive({ session, learner, assignment })
      .where(activeUser({ session }), isNotActiveStudent({ user: learner }))
      .then(respond({ error: "NOT_FOUND" })),
);

export const StaffChangeUnauthorized = endpoint(
  "/late-days/staff-change",
  ({ session, learner, assignment, days, user }) =>
    receive({ session, learner, assignment, days })
      .where(
        activeUser({ session }).is({ user }),
        mayNotManageLateDays({ user }),
        isActiveStudent({ user: learner }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);
export const StaffCancelUnauthorized = endpoint(
  "/late-days/staff-cancel",
  ({ session, learner, assignment, user }) =>
    receive({ session, learner, assignment })
      .where(
        activeUser({ session }).is({ user }),
        mayNotManageLateDays({ user }),
        isActiveStudent({ user: learner }),
      )
      .then(respond({ error: "NOT_FOUND" })),
);

export const ForAssignment = endpoint(
  "/late-days/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayManageLateDays({ user }))
      .then(respond({ users: theLateDayUsesOn(assignment) })),
  { input: { required: ["session", "assignment"] } },
);

export const ForAssignmentForbidden = endpoint(
  "/late-days/for-assignment",
  ({ session, assignment, user }) =>
    receive({ session, assignment })
      .where(activeUser({ session }).is({ user }), mayNotManageLateDays({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
