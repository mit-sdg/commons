import { activeUser } from "../access/session.ts";
import {
  each,
  former,
  no,
  now,
  reaction,
  view,
  when,
  where,
  whether,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { theInvitationFor } from "../access/invitations.ts";
import { mayManageCourse, mayNotManageCourse } from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

const { Inviting, Profiling, Rostering } = concepts;

/** Which sections exist? */
export const theSections = former(
  "the sections ()",
  (_inputs, { section, name, location, meetingPattern, status }) =>
    each(Rostering._getSections({}).is({ section, name, location, meetingPattern, status })).form({
      section,
      name,
      location,
      meetingPattern,
      status,
    }),
);
/** What class has been configured? */
export const theClassConfiguration = view(
  "the class configuration ()",
  (_inputs, { detail }, _bindings) => where(Rostering._getClass({}).is({ detail })),
).optional();
/** Who belongs on the active roster? */
export const theRoster = former(
  "the roster ()",
  (_inputs, { user, seat, kind, section, email, displayName }) =>
    each(Rostering._getActiveMembers({}).is({ user, seat, kind, section, email }))
      .where(whether(Profiling._getProfileFields({ user }).is({ displayName })))
      .form({
        user,
        seat,
        kind,
        section,
        email,
        displayName,
      }),
);
/** Which seats are still waiting for their invitation to be accepted? */
export const thePendingRoster = former(
  "the pending roster ()",
  (_inputs, { seat, email, kind, section }) =>
    each(Rostering._getUnclaimedSeats({}).is({ seat, email, kind, section })).form({
      seat,
      email,
      kind,
      section,
    }),
);
/** Which seats have been dropped? */
export const theDroppedRoster = former(
  "the dropped roster ()",
  (_inputs, { user, seat, kind, section, email, displayName }) =>
    each(Rostering._getDroppedSeats({}).is({ user, seat, kind, section, email }))
      .where(whether(Profiling._getProfileFields({ user }).is({ displayName })))
      .form({
        user,
        seat,
        kind,
        section,
        email,
        displayName,
      }),
);
/**
 * Which active seat belongs to this user? The query falls back to a held seat
 * that is no longer active, so the status is bound here: a dropped person holds
 * no seat until their seat is reinstated.
 */
export const theSeatOf = view("the seat of (user)", ({ user }, { seat }, _bindings) =>
  where(Rostering._getSeatByUser({ user }).is({ seat, status: "ACTIVE" })),
).optional();
/**
 * An imported seat invites its address, so a CSV import and an invitation are
 * the same act rather than two records that later have to be reconciled.
 * Addresses that have already been invited are left alone, which keeps a repeat
 * import from resending mail.
 */
export const ImportedSeatInvitesItsAddress = reaction(({ email, at }) =>
  when(Rostering.importSeats({}).responds({}))
    .where(
      now(at),
      Rostering._getUnclaimedSeats({}).is({ email }),
      no(theInvitationFor({ address: email })),
    )
    .then(Inviting.invite({ channel: "email", address: email, at })),
);

/**
 * Accepting an invitation claims the seat held for that address. The claim
 * carries the address itself, so no separate profile-to-seat matching step is
 * needed.
 */
export const ClaimedInvitationClaimsItsSeat = reaction(({ address, user, seat }) =>
  when(Inviting.claim({ user }).responds({ channel: "email", address }))
    .where(Rostering._getPendingSeatByEmail({ email: address }).is({ seat }))
    .then(Rostering.claimSeat({ seat, user })),
);

export const ConfigureClass = endpoint(
  "/roster/configure-class",
  ({ session, code, title, term, timezone, user, class: classDoc }) =>
    receive({ session, code, title, term, timezone }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(
          Rostering.configureClass({ code, title, term, timezone }).responds({ class: classDoc }),
        )
        .then(respond({ class: classDoc }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ClassConfiguration = endpoint("/roster/class", ({ session, user, detail }) =>
  receive({ session }).then(
    where(
      activeUser({ session }).is({ user }),
      mayManageCourse({ user }),
      theClassConfiguration({}).is({ detail }),
    )
      .then(respond({ class: detail }))
      .named("found"),
    where(
      activeUser({ session }).is({ user }),
      mayManageCourse({ user }),
      no(theClassConfiguration({})),
    )
      .then(respond({ class: null }))
      .named("absent"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const RosterMe = endpoint("/roster/me", ({ session, user, seat }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .then(
      where(theSeatOf({ user }).is({ seat })).then(respond({ seat })).named("found"),
      where(no(theSeatOf({ user })))
        .then(respond({ seat: null }))
        .named("absent"),
    ),
);

export const SectionsList = endpoint("/roster/sections/list", () =>
  receive().then(respond({ sections: theSections({}) })),
);

export const SectionsCreate = endpoint(
  "/roster/sections/create",
  ({ session, name, location, meetingPattern, user, section }) =>
    receive({ session, name, location, meetingPattern }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Rostering.createSection({ name, location, meetingPattern }).responds({ section }))
        .then(respond({ section }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "name"],
      defaults: { location: null, meetingPattern: null },
    },
  },
);

export const SectionsUpdate = endpoint(
  "/roster/sections/update",
  ({ session, section, name, location, meetingPattern, user, updated }) =>
    receive({ session, section, name, location, meetingPattern }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(
          Rostering.updateSection({ section, name, location, meetingPattern }).responds({
            section: updated,
          }),
        )
        .then(respond({ section: updated }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ImportPreview = endpoint("/roster/import-preview", ({ csv, rows }) =>
  receive({ csv })
    .then(Rostering.previewImport({ csv }).responds({ rows }))
    .then(respond({ rows })),
);

export const ImportSeats = endpoint("/roster/import", ({ session, rows, user, created, skipped }) =>
  receive({ session, rows }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(Rostering.importSeats({ rows }).responds({ created, skipped }))
      .then(respond({ created, skipped }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

/**
 * Enrol somebody who already has an account, without waiting on an import. This
 * is the single-person counterpart to a CSV import.
 */
export const Enrol = endpoint(
  "/roster/enroll",
  ({ session, email, kind, section, user: target, actor, seat }) =>
    receive({ session, email, kind, section, user: target }).then(
      where(activeUser({ session }).is({ user: actor }), mayManageCourse({ user: actor }))
        .then(Rostering.enrol({ email, kind, section, user: target }).responds({ seat }))
        .then(respond({ seat }))
        .named("success"),
      where(activeUser({ session }).is({ user: actor }), mayNotManageCourse({ user: actor }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "email", "user"],
      defaults: { kind: "STUDENT", section: null },
    },
  },
);

export const RosterList = endpoint("/roster/list", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(respond({ members: theRoster({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const PendingRoster = endpoint("/roster/pending", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(respond({ members: thePendingRoster({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const DroppedRoster = endpoint("/roster/dropped", ({ session, user }) =>
  receive({ session }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(respond({ members: theDroppedRoster({}) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const DropSeat = endpoint("/roster/drop", ({ session, seat, user, dropped }) =>
  receive({ session, seat }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(Rostering.dropSeat({ seat }).responds({ seat: dropped }))
      .then(respond({ seat: dropped }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const ReinstateSeat = endpoint("/roster/reinstate", ({ session, seat, user, reinstated }) =>
  receive({ session, seat }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(Rostering.reinstateSeat({ seat }).responds({ seat: reinstated }))
      .then(respond({ seat: reinstated }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const MoveSection = endpoint(
  "/roster/move-section",
  ({ session, seat, section, user, moved }) =>
    receive({ session, seat, section }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Rostering.moveSection({ seat, section }).responds({ seat: moved }))
        .then(respond({ seat: moved }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);
