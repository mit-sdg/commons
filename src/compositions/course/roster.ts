import { activeUser } from "../access/session.ts";
import {
  compute,
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
import { isArchived, mayManageCourse, mayNotManageCourse } from "../access/policy.ts";
import { computations, concepts } from "../../concepts.ts";

const { Authenticating, Inviting, Profiling, Rostering } = concepts;

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
  (_inputs, { seat, email, kind, section, displayName }) =>
    each(Rostering._getUnclaimedSeats({}).is({ seat, email, kind, section, displayName })).form({
      seat,
      email,
      kind,
      section,
      displayName,
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
 * Which account holds this address? Authenticating owns a person's email and
 * holds it for one account alone, so this answers at most one account. Every
 * side normalizes an address the same way, so the row that was imported and the
 * address an account holds are one string.
 */
export const theAccountAt = view("the account at (email)", ({ email }, { user }, _bindings) =>
  where(Authenticating._getByEmail({ email }).is({ user })),
).optional();

/**
 * Which account that can still sign in holds this address? An archived account
 * holds its address but can never sign in, so it answers `theAccountAt` and not
 * this: a seat at that address is neither invited nor claimed.
 */
export const theLiveAccountAt = view(
  "the live account at (email)",
  ({ email }, { user }, _bindings) =>
    where(Authenticating._getByEmail({ email }).is({ user }), no(isArchived({ user }))),
).optional();

/**
 * Which seat already stands at this address? Rostering holds at most one seat
 * for an address, so this answers that seat in whichever state it is. Adding a
 * person by hand branches on it: an active or dropped seat is refused, while a
 * still-pending seat is the one a second add refreshes and sends back through
 * the sweep.
 */
export const theSeatAt = view("the seat at (email)", ({ email }, { seat }, _bindings) =>
  where(Rostering._getSeatByEmail({ email }).is({ seat })),
).optional();

/**
 * A pending seat whose address already answers a live account is claimed for it
 * at once, so somebody who already has an account is enrolled rather than sent
 * an invitation to register a second time — an invitation nobody could accept.
 *
 * It reaches the active seat through `claimSeat` rather than `enrol`
 * deliberately: a claim is the transition Assignments watches, so an
 * immediately enrolled student receives the work already published to their
 * section, while the same seat reached by enrolling would leave them holding
 * none.
 *
 * The sweep reads every pending seat rather than only the rows this import just
 * created, which is what makes importing an address a second time a repair.
 */
export const ImportedSeatClaimsItsAccount = reaction(({ seat, email, user }) =>
  when(Rostering.importSeats({}).responds({}))
    .where(
      Rostering._getUnclaimedSeats({}).is({ seat, email }),
      theLiveAccountAt({ email }).is({ user }),
    )
    .then(Rostering.claimSeat({ seat, user })),
);

/**
 * An imported seat invites its address, so a CSV import and an invitation are
 * the same act rather than two records that later have to be reconciled.
 * Addresses that already answer an account — live or archived — are left to the
 * claim above or to nothing at all, and addresses that have already been invited
 * are left alone, which keeps a repeat import from resending mail.
 */
export const ImportedSeatInvitesItsAddress = reaction(({ email, at }) =>
  when(Rostering.importSeats({}).responds({}))
    .where(
      now(at),
      Rostering._getUnclaimedSeats({}).is({ email }),
      no(theAccountAt({ email })),
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

/**
 * Establishing the class and correcting it stay separate acts: `configureClass`
 * keeps its `CLASS_ALREADY_CONFIGURED` guard, and this refuses
 * `CLASS_NOT_CONFIGURED` while there is no class to revise.
 */
export const UpdateClass = endpoint(
  "/roster/update-class",
  ({ session, code, title, term, timezone, user, class: classDoc }) =>
    receive({ session, code, title, term, timezone }).then(
      where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
        .then(Rostering.updateClass({ code, title, term, timezone }).responds({ class: classDoc }))
        .then(respond({ class: classDoc }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ClassConfiguration = endpoint("/roster/class", ({ session, detail }) =>
  receive({ session }).then(
    where(activeUser({ session }), theClassConfiguration({}).is({ detail }))
      .then(respond({ class: detail }))
      .named("found"),
    where(activeUser({ session }), no(theClassConfiguration({})))
      .then(respond({ class: null }))
      .named("absent"),
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
 * Add one person to the roster by hand, from the staff roster page and without
 * writing CSV.
 *
 * The form's fields compose one import row, and the seat is created through the
 * very import action a one-row CSV would reach, so the sweep that claims a seat
 * whose address already has an account — releasing the work already published to
 * that section — and invites one whose address has none follows a hand-add
 * exactly as it follows an import. That is why this form does not enrol:
 * `Enrol` reaches an active seat without that release fan-out.
 *
 * An address that already carries an active or dropped seat is refused
 * `SEAT_ALREADY_EXISTS`, because reinstating or removing that seat is the repair
 * there. A still-pending seat is not refused: no second seat is created, the
 * seat keeps the kind and section it was created with, only its display name is
 * refreshed, and it re-enters the sweep — exactly the repair re-importing the
 * row performs.
 *
 * The answer reports only what this request can see for itself: whether it
 * created a seat at that address or found one already standing there, and what
 * the account at that address answers while the request is still running — an
 * account that can still sign in, an archived one, or none at all. It never
 * reports what the sweep will have done, because the claim and the invitation
 * commit after this answer is formed; the active, pending, and dropped rosters
 * are the durable answer, and a staff surface reads them again rather than
 * trusting this response.
 */
export const AddPerson = endpoint(
  "/roster/add-person",
  ({ session, email, kind, section, displayName, user, rows }) =>
    receive({ session, email, kind, section, displayName }).then(
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        theSeatAt({ email }),
        no(Rostering._getPendingSeatByEmail({ email })),
      )
        .then(respond({ error: "SEAT_ALREADY_EXISTS" }))
        .named("seat-already-exists"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        theSeatAt({ email }),
        Rostering._getPendingSeatByEmail({ email }),
        theLiveAccountAt({ email }),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: false, account: "LIVE" }))
        .named("standing-seat-live-account"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        theSeatAt({ email }),
        Rostering._getPendingSeatByEmail({ email }),
        theAccountAt({ email }),
        no(theLiveAccountAt({ email })),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: false, account: "ARCHIVED" }))
        .named("standing-seat-archived-account"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        theSeatAt({ email }),
        Rostering._getPendingSeatByEmail({ email }),
        no(theAccountAt({ email })),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: false, account: "NONE" }))
        .named("standing-seat-without-account"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        no(theSeatAt({ email })),
        theLiveAccountAt({ email }),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: true, account: "LIVE" }))
        .named("new-seat-live-account"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        no(theSeatAt({ email })),
        theAccountAt({ email }),
        no(theLiveAccountAt({ email })),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: true, account: "ARCHIVED" }))
        .named("new-seat-archived-account"),
      where(
        activeUser({ session }).is({ user }),
        mayManageCourse({ user }),
        compute(computations.singleImportRow, { email, kind, section, displayName }, rows),
        no(theSeatAt({ email })),
        no(theAccountAt({ email })),
      )
        .then(Rostering.importSeats({ rows }))
        .then(respond({ created: true, account: "NONE" }))
        .named("new-seat-without-account"),
      where(activeUser({ session }).is({ user }), mayNotManageCourse({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "email"],
      defaults: { kind: "STUDENT", section: "", displayName: "" },
    },
  },
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

/**
 * Removal is the destructive counterpart to dropping: it deletes the seat in
 * whichever state it is and nothing else. The account stays registered and able
 * to sign in, it keeps whatever role it holds, and every course record keyed to
 * it is retained. The response carries the address the removal freed, because
 * once the seat is gone no read can report it.
 */
export const RemoveSeat = endpoint("/roster/remove", ({ session, seat, user, removed, email }) =>
  receive({ session, seat }).then(
    where(activeUser({ session }).is({ user }), mayManageCourse({ user }))
      .then(Rostering.removeSeat({ seat }).responds({ seat: removed, email }))
      .then(respond({ seat: removed, email }))
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
