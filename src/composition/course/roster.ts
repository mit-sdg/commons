import { activeUser } from "../access/session.ts";
import {
  each,
  former,
  no,
  reaction,
  request,
  view,
  when,
  where,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { COURSE_STAFF_ROLE, FORUM, STAFF_CAPABILITIES } from "../access/capabilities.ts";
import { mayManageRoster, mayNotManageRoster } from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Profiling, Roling, Rostering } = concepts;

/** Which sections exist? */
export const theSections = former(
  "the sections ()",
  ({ section, name, location, meetingPattern, status }) =>
    each(Rostering._getSections({}).is({ section, name, location, meetingPattern, status })).form({
      section,
      name,
      location,
      meetingPattern,
      status,
    }),
);
/** Who belongs on the active roster? */
export const theRoster = former(
  "the roster ()",
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
/** Which seat belongs to this user? */
export const theSeatOf = view("the seat of (user) with optional (seat)", ({ user, seat }) =>
  where(Rostering._getSeatByUser({ user }).is({ seat })),
);
export const identityMatchedSeat = view(
  "the seat matching (user) and (externalKey) with optional (seat)",
  ({ user, externalKey, seat, email }) =>
    where(
      Profiling._getProfileFields({ user }).is({ email }),
      Rostering._getSeatByExternalKey({ externalKey }).is({ seat, email }),
    ),
);
export const StaffSeatGrantsCourseStaff = reaction(({ claimer, role }) =>
  when(Rostering.claimSeat, { user: claimer }, { kind: "STAFF" })
    .where(
      Roling._holdsRoleNamed({
        user: claimer,
        context: FORUM,
        name: COURSE_STAFF_ROLE,
      }).is({ held: false }),
    )
    .then(
      request(
        Roling.ensureRole,
        { name: COURSE_STAFF_ROLE, capabilities: STAFF_CAPABILITIES },
        { role },
      ),
      request(Roling.grant, { user: claimer, context: FORUM, role }),
    ),
);
export const DroppedStaffSeatRevokesCourseStaff = reaction(({ holder, role }) =>
  when(Rostering.dropSeat, {}, { kind: "STAFF", user: holder })
    .where(
      Roling._getRoleByName({ name: COURSE_STAFF_ROLE }).is({ role }),
      Roling._getRoles({ user: holder, context: FORUM }).is({ role }),
    )
    .then(request(Roling.revoke, { user: holder, context: FORUM, role })),
);

export const ConfigureClass = endpoint(
  "/roster/configure-class",
  ({ session, code, title, term, timezone, user, class: classDoc }) =>
    receive({ session, code, title, term, timezone })
      .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
      .then(
        request(Rostering.configureClass, { code, title, term, timezone }, { class: classDoc }),
        respond({ class: classDoc }),
      ),
);

export const ConfigureClassForbidden = endpoint(
  "/roster/configure-class",
  ({ session, code, title, term, timezone, user }) =>
    receive({ session, code, title, term, timezone })
      .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const RosterMe = endpoint("/roster/me", ({ session, user, seat }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }))
    .either(
      where(theSeatOf({ user }).is({ seat })).then(respond({ seat })),
      where(no(theSeatOf({ user }))).then(respond({ seat: null })),
    ),
);

export const SectionsList = endpoint("/roster/sections/list", () =>
  receive().then(respond({ sections: theSections() })),
);

export const SectionsCreate = endpoint(
  "/roster/sections/create",
  ({ session, name, location, meetingPattern, user, section }) =>
    receive({ session, name, location, meetingPattern })
      .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
      .then(
        request(Rostering.createSection, { name, location, meetingPattern }, { section }),
        respond({ section }),
      ),
  {
    input: {
      required: ["session", "name"],
      defaults: { location: null, meetingPattern: null },
    },
  },
);

export const SectionsCreateForbidden = endpoint(
  "/roster/sections/create",
  ({ session, name, location, meetingPattern, user }) =>
    receive({ session, name, location, meetingPattern })
      .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const SectionsUpdate = endpoint(
  "/roster/sections/update",
  ({ session, section, name, location, meetingPattern, user, updated }) =>
    receive({ session, section, name, location, meetingPattern })
      .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
      .then(
        request(
          Rostering.updateSection,
          { section, name, location, meetingPattern },
          { section: updated },
        ),
        respond({ section: updated }),
      ),
);

export const SectionsUpdateForbidden = endpoint(
  "/roster/sections/update",
  ({ session, section, name, location, meetingPattern, user }) =>
    receive({ session, section, name, location, meetingPattern })
      .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const ImportPreview = endpoint("/roster/import-preview", ({ csv, rows }) =>
  receive({ csv }).then(request(Rostering.previewImport, { csv }, { rows }), respond({ rows })),
);

export const ImportSeats = endpoint("/roster/import", ({ session, rows, user, created, skipped }) =>
  receive({ session, rows })
    .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
    .then(
      request(Rostering.importSeats, { rows }, { created, skipped }),
      respond({ created, skipped }),
    ),
);

export const ImportSeatsForbidden = endpoint("/roster/import", ({ session, rows, user }) =>
  receive({ session, rows })
    .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const ClaimSeat = endpoint(
  "/roster/claim-seat",
  ({ session, externalKey, user, seat, claimed }) =>
    receive({ session, externalKey })
      .where(activeUser({ session }).is({ user }))
      .either(
        where(identityMatchedSeat({ user, externalKey }).is({ seat })).then(
          request(Rostering.claimSeat, { seat, user }, { seat: claimed }),
          respond({ seat: claimed }),
        ),
        where(no(identityMatchedSeat({ user, externalKey }))).then(
          respond({ error: "SEAT_NOT_FOUND" }),
        ),
      ),
);
export const LinkUser = endpoint(
  "/roster/link-user",
  ({ session, seat, user: target, actor, linked }) =>
    receive({ session, seat, user: target })
      .where(activeUser({ session }).is({ user: actor }), mayManageRoster({ user: actor }))
      .then(
        request(Rostering.claimSeat, { seat, user: target }, { seat: linked }),
        respond({ seat: linked }),
      ),
);

export const LinkUserForbidden = endpoint(
  "/roster/link-user",
  ({ session, seat, user: target, actor }) =>
    receive({ session, seat, user: target })
      .where(activeUser({ session }).is({ user: actor }), mayNotManageRoster({ user: actor }))
      .then(respond({ error: "FORBIDDEN" })),
);

export const RosterList = endpoint("/roster/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
    .then(respond({ members: theRoster() })),
);

export const RosterListForbidden = endpoint("/roster/list", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const DropSeat = endpoint("/roster/drop", ({ session, seat, user, dropped }) =>
  receive({ session, seat })
    .where(activeUser({ session }).is({ user }))
    .then(
      request(Roling.requireCapability, { user, context: FORUM, capability: "roster:manage" }),
      request(Rostering.dropSeat, { seat }, { seat: dropped }),
      respond({ seat: dropped }),
    ),
);

export const ReinstateSeat = endpoint("/roster/reinstate", ({ session, seat, user, reinstated }) =>
  receive({ session, seat })
    .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
    .then(
      request(Rostering.reinstateSeat, { seat }, { seat: reinstated }),
      respond({ seat: reinstated }),
    ),
);

export const ReinstateSeatForbidden = endpoint("/roster/reinstate", ({ session, seat, user }) =>
  receive({ session, seat })
    .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);

export const MoveSection = endpoint(
  "/roster/move-section",
  ({ session, seat, section, user, moved }) =>
    receive({ session, seat, section })
      .where(activeUser({ session }).is({ user }), mayManageRoster({ user }))
      .then(
        request(Rostering.moveSection, { seat, section }, { seat: moved }),
        respond({ seat: moved }),
      ),
);

export const MoveSectionForbidden = endpoint(
  "/roster/move-section",
  ({ session, seat, section, user }) =>
    receive({ session, seat, section })
      .where(activeUser({ session }).is({ user }), mayNotManageRoster({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
