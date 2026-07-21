import { activeUser } from "../access/session.ts";
import { each, former, no, view, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageStudentNotes,
  mayNotManageStudentNotes,
} from "../access/policy.ts";
import { concepts } from "../../concepts/index.ts";

const { Noting, Rostering, Timing } = concepts;
/** Which staff notes are about this learner? */
export const theStaffNotesOn = former(
  "the staff notes on (learner)",
  ({
    learner,
    note,
    author,
    body,
    visibility,
    status,
    createdAt,
    updatedAt,
    followUpAt,
    acknowledgedAt,
    tags,
  }) =>
    each(
      Noting._getActiveNotesFor({ learner }).is({
        note,
        author,
        body,
        visibility,
        status,
        createdAt,
        updatedAt,
        followUpAt,
        acknowledgedAt,
        tags,
      }),
    ).form({
      note,
      author,
      learner,
      body,
      visibility,
      status,
      createdAt,
      updatedAt,
      followUpAt,
      acknowledgedAt,
      tags,
    }),
);
/** Which notes are shown to this learner? */
export const theNotesShownTo = former(
  "the notes shown to (learner)",
  ({
    learner,
    note,
    author,
    body,
    status,
    createdAt,
    updatedAt,
    followUpAt,
    acknowledgedAt,
    tags,
  }) =>
    each(
      Noting._getShownTo({ learner }).is({
        note,
        author,
        body,
        status,
        createdAt,
        updatedAt,
        followUpAt,
        acknowledgedAt,
        tags,
      }),
    ).form({
      note,
      author,
      learner,
      body,
      status,
      createdAt,
      updatedAt,
      followUpAt,
      acknowledgedAt,
      tags,
    }),
);
/** What seat detail belongs to this user? */
export const theSeatDetailOf = view(
  "the seat detail of (user) with optional (detail)",
  ({ user, detail }) => where(Rostering._getSeatDetail({ user }).is({ detail })),
);
export const Write = endpoint(
  "/students/notes/write",
  ({ session, learner, body, visibility, tags, followUpAt, user, at, note }) =>
    receive({ session, learner, body, visibility, tags, followUpAt })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageStudentNotes({ user }),
      )
      .then(
        Noting.write({ author: user, learner, body, visibility, tags, followUpAt, at }).responds({
          note,
        }),
      )
      .then(respond({ note })),
  { input: { required: ["session", "learner", "body", "visibility", "tags", "followUpAt"] } },
);

export const WriteForbidden = endpoint(
  "/students/notes/write",
  ({ session, learner, body, visibility, tags, followUpAt, user }) =>
    receive({ session, learner, body, visibility, tags, followUpAt })
      .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const Revise = endpoint(
  "/students/notes/revise",
  ({ session, note, body, visibility, tags, followUpAt, user, at }) =>
    receive({ session, note, body, visibility, tags, followUpAt })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageStudentNotes({ user }),
      )
      .then(Noting.revise({ note, body, visibility, tags, followUpAt, at }).responds({ note }))
      .then(respond({ note })),
  { input: { required: ["session", "note", "body", "visibility", "tags", "followUpAt"] } },
);

export const ReviseForbidden = endpoint(
  "/students/notes/revise",
  ({ session, note, body, visibility, tags, followUpAt, user }) =>
    receive({ session, note, body, visibility, tags, followUpAt })
      .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const Resolve = endpoint(
  "/students/notes/resolve",
  ({ session, note, user, at }) =>
    receive({ session, note })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageStudentNotes({ user }),
      )
      .then(Noting.resolve({ note, at }).responds({ note }))
      .then(respond({ note })),
  { input: { required: ["session", "note"] } },
);

export const ResolveForbidden = endpoint("/students/notes/resolve", ({ session, note, user }) =>
  receive({ session, note })
    .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const Archive = endpoint(
  "/students/notes/archive",
  ({ session, note, user, at }) =>
    receive({ session, note })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageStudentNotes({ user }),
      )
      .then(Noting.archive({ note, at }).responds({ note }))
      .then(respond({ note })),
  { input: { required: ["session", "note"] } },
);

export const ArchiveForbidden = endpoint("/students/notes/archive", ({ session, note, user }) =>
  receive({ session, note })
    .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const Restore = endpoint(
  "/students/notes/restore",
  ({ session, note, user, at }) =>
    receive({ session, note })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        mayManageStudentNotes({ user }),
      )
      .then(Noting.restore({ note, at }).responds({ note }))
      .then(respond({ note })),
  { input: { required: ["session", "note"] } },
);

export const RestoreForbidden = endpoint("/students/notes/restore", ({ session, note, user }) =>
  receive({ session, note })
    .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const Acknowledge = endpoint(
  "/students/notes/acknowledge",
  ({ session, note, user, at }) =>
    receive({ session, note })
      .where(
        Timing._now({}).is({ at }),
        activeUser({ session }).is({ user }),
        isActiveStudent({ user }),
      )
      .then(Noting.acknowledge({ note, learner: user, at }).responds({ note }))
      .then(respond({ note })),
  { input: { required: ["session", "note"] } },
);

export const AcknowledgeForbidden = endpoint(
  "/students/notes/acknowledge",
  ({ session, note, user }) =>
    receive({ session, note })
      .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
      .then(respond({ error: "FORBIDDEN" })),
);
export const NotesList = endpoint(
  "/students/notes/list",
  ({ session, learner, user }) =>
    receive({ session, learner })
      .where(activeUser({ session }).is({ user }), mayManageStudentNotes({ user }))
      .then(respond({ notes: theStaffNotesOn(learner) })),
  { input: { required: ["session", "learner"] } },
);

export const NotesListForbidden = endpoint("/students/notes/list", ({ session, learner, user }) =>
  receive({ session, learner })
    .where(activeUser({ session }).is({ user }), mayNotManageStudentNotes({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const NotesVisible = endpoint(
  "/students/notes/visible",
  ({ session, user }) =>
    receive({ session })
      .where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
      .then(respond({ notes: theNotesShownTo(user) })),
  { input: { required: ["session"] } },
);

export const NotesVisibleForbidden = endpoint("/students/notes/visible", ({ session, user }) =>
  receive({ session })
    .where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
    .then(respond({ error: "FORBIDDEN" })),
);
export const StudentsDetail = endpoint(
  "/students/detail",
  ({ session, user: caller, target, detail }) =>
    receive({ session, user: target })
      .where(activeUser({ session }).is({ user: caller }), mayManageStudentNotes({ user: caller }))
      .then(
        where(theSeatDetailOf({ user: target }).is({ detail }))
          .then(respond({ detail }))
          .named("case-1"),
        where(no(theSeatDetailOf({ user: target })))
          .then(respond({ detail: null }))
          .named("case-2"),
      ),
  { input: { required: ["session", "user"] } },
);

export const StudentsDetailForbidden = endpoint(
  "/students/detail",
  ({ session, user: caller, target }) =>
    receive({ session, user: target })
      .where(
        activeUser({ session }).is({ user: caller }),
        mayNotManageStudentNotes({ user: caller }),
      )
      .then(respond({ error: "FORBIDDEN" })),
);
