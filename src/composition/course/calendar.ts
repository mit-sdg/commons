import { activeUser } from "../access/session.ts";
import { each, form, former, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageRoster,
  mayNotManageRoster,
  mayNotViewStaffCalendar,
  mayViewStaffCalendar,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Assigning, Banking, Itemizing, Rostering } = concepts;
/** Which calendar entries fall between these moments? */
export const theCalendarBetween = former(
  "the calendar between (start) and (end)",
  ({ start, end }, { assignment, title, kind, availableAt, dueAt, closeAt, status }) =>
    each(Assigning._getPublishedInWindow({ start, end }).is({ assignment }))
      .where(
        Assigning._getAssignments({}).is({
          assignment,
          title,
          kind,
          availableAt,
          dueAt,
          closeAt,
          status,
        }),
      )
      .form({ assignment, title, kind, availableAt, dueAt, closeAt, status }),
);
/** What dashboard seat belongs to this user? */
export const theDashboardSeatOf = former(
  "the dashboard seat of (user)",
  ({ user }, { seat, holder, externalKey, email, rosterName, kind, section, status }) =>
    each(
      Rostering._getSeatByUser({ user }).is({
        seat,
        user: holder,
        externalKey,
        email,
        rosterName,
        kind,
        section,
        status,
      }),
    ).form({
      seat,
      user: holder,
      externalKey,
      email,
      rosterName,
      kind,
      section,
      status,
    }),
);
/** What belongs on the staff dashboard? */
export const theStaffDashboard = former(
  "the staff dashboard ()",
  (_inputs, { user, seat, kind, section, rosterName, email }) =>
    each(Rostering._getActiveMembers({}).is({ user, seat, kind, section, rosterName, email })).form(
      {
        user,
        seat,
        kind,
        section,
        rosterName,
        email,
      },
    ),
);
/** What coursework counts belong on the staff dashboard? */
export const theStaffDashboardCounts = former(
  "the staff dashboard counts ()",
  (_inputs, { assignment, item, learner, use }) =>
    form({
      assignments: each(Assigning._getAssignments({}).is({ assignment })).count(),
      gradeItems: each(Itemizing._getItems({}).is({ item })).count(),
      lateDayUses: each(Rostering._getActiveStudents({}).is({ user: learner }))
        .where(Banking._getUses({ learner }).is({ use, status: "APPLIED" }))
        .count(),
    }),
);
export const CalendarMe = endpoint(
  "/calendar/me",
  ({ session, start, end, user }) =>
    receive({ session, start, end }).then(
      where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
        .then(respond({ events: theCalendarBetween({ start, end }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "start", "end"] } },
);

export const CalendarStaff = endpoint(
  "/calendar/staff",
  ({ session, start, end, user }) =>
    receive({ session, start, end }).then(
      where(activeUser({ session }).is({ user }), mayViewStaffCalendar({ user }))
        .then(respond({ events: theCalendarBetween({ start, end }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotViewStaffCalendar({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "start", "end"] } },
);

export const LmsMe = endpoint(
  "/lms/me",
  ({ session, user }) =>
    receive({ session }).then(
      where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
        .then(respond({ dashboard: theDashboardSeatOf({ user }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session"] } },
);

export const LmsStaffDashboard = endpoint(
  "/lms/staff-dashboard",
  ({ session, user }) =>
    receive({ session }).then(
      where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
        .then(respond({ dashboard: theStaffDashboard({}), counts: theStaffDashboardCounts({}) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session"] } },
);
