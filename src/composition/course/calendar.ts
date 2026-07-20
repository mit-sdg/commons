import { activeUser } from "../access/session.ts";
import { each, form, former } from "@mit-sdg/sync-engine/language";
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
  ({ start, end, assignment, title, kind, availableAt, dueAt, closeAt, status }) =>
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
  ({ user, seat, holder, externalKey, email, rosterName, kind, section, status }) =>
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
  ({ user, seat, kind, section, rosterName, email }) =>
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
  ({ assignment, item, learner, use }) =>
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
    receive({ session, start, end })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ events: theCalendarBetween(start, end) })),
  { input: { required: ["session", "start", "end"] } },
);

export const CalendarMeForbidden = endpoint("/calendar/me", ({ session, start, end, user }) =>
  receive({ session, start, end })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const CalendarStaff = endpoint(
  "/calendar/staff",
  ({ session, start, end, user }) =>
    receive({ session, start, end })
      .where(activeUser({ session }).is({ user }), mayViewStaffCalendar({ user }))
      .then(respond({ events: theCalendarBetween(start, end) })),
  { input: { required: ["session", "start", "end"] } },
);

export const CalendarStaffForbidden = endpoint("/calendar/staff", ({ session, start, end, user }) =>
  receive({ session, start, end })
    .where(activeUser({ session }).is({ user }), mayNotViewStaffCalendar({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const LmsMe = endpoint(
  "/lms/me",
  ({ session, user }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ dashboard: theDashboardSeatOf(user) })),
  { input: { required: ["session"] } },
);

export const LmsMeForbidden = endpoint("/lms/me", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const LmsStaffDashboard = endpoint(
  "/lms/staff-dashboard",
  ({ session, user }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
      .then(respond({ dashboard: theStaffDashboard(), counts: theStaffDashboardCounts() })),
  { input: { required: ["session"] } },
);

export const LmsStaffDashboardForbidden = endpoint("/lms/staff-dashboard", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
