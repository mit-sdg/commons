import { activeUser } from "../access/session.ts";
import { each, former, no, view, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  isActiveStudent,
  isNotActiveStudent,
  mayManageStudentRecords,
  mayNotManageStudentRecords,
} from "../access/policy.ts";
import { concepts } from "../../concepts.ts";

const { Noting, Profiling, Rostering } = concepts;
/** Which staff notes are about this learner? */
export const theStaffNotesOn = former(
  "the staff notes on (learner)",
  (
    { learner },
    {
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
    },
  ) =>
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
  (
    { learner },
    { note, author, body, status, createdAt, updatedAt, followUpAt, acknowledgedAt, tags },
  ) =>
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
  "the seat detail of (user)",
  ({ user }, { detail }, _bindings) => where(Rostering._getSeatDetail({ user }).is({ detail })),
).optional();
export const Write = endpoint(
  "/students/notes/write",
  ({ session, learner, body, visibility, tags, followUpAt, user, at, note }) =>
    receive({ session, learner, body, visibility, tags, followUpAt }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(
          Noting.write({ author: user, learner, body, visibility, tags, followUpAt, at }).responds({
            note,
          }),
        )
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "learner", "body", "visibility", "tags", "followUpAt"] } },
);

export const Revise = endpoint(
  "/students/notes/revise",
  ({ session, note, body, visibility, tags, followUpAt, user, at }) =>
    receive({ session, note, body, visibility, tags, followUpAt }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(Noting.revise({ note, body, visibility, tags, followUpAt, at }).responds({ note }))
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "note", "body", "visibility", "tags", "followUpAt"] } },
);

export const Resolve = endpoint(
  "/students/notes/resolve",
  ({ session, note, user, at }) =>
    receive({ session, note }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(Noting.resolve({ note, at }).responds({ note }))
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "note"] } },
);

export const Archive = endpoint(
  "/students/notes/archive",
  ({ session, note, user, at }) =>
    receive({ session, note }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(Noting.archive({ note, at }).responds({ note }))
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "note"] } },
);

export const Restore = endpoint(
  "/students/notes/restore",
  ({ session, note, user, at }) =>
    receive({ session, note }).then(
      where(now(at), activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(Noting.restore({ note, at }).responds({ note }))
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "note"] } },
);

export const Acknowledge = endpoint(
  "/students/notes/acknowledge",
  ({ session, note, user, at }) =>
    receive({ session, note }).then(
      where(now(at), activeUser({ session }).is({ user }), isActiveStudent({ user }))
        .then(Noting.acknowledge({ note, learner: user, at }).responds({ note }))
        .then(respond({ note }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "note"] } },
);

export const NotesList = endpoint(
  "/students/notes/list",
  ({ session, learner, user }) =>
    receive({ session, learner }).then(
      where(activeUser({ session }).is({ user }), mayManageStudentRecords({ user }))
        .then(respond({ notes: theStaffNotesOn({ learner }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotManageStudentRecords({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "learner"] } },
);

export const NotesVisible = endpoint(
  "/students/notes/visible",
  ({ session, user }) =>
    receive({ session }).then(
      where(activeUser({ session }).is({ user }), isActiveStudent({ user }))
        .then(respond({ notes: theNotesShownTo({ learner: user }) }))
        .named("success"),
      where(activeUser({ session }).is({ user }), isNotActiveStudent({ user }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session"] } },
);

export const StudentsDetail = endpoint(
  "/students/detail",
  ({ session, user: caller, target, detail, displayName }) =>
    receive({ session, user: target }).then(
      where(
        activeUser({ session }).is({ user: caller }),
        mayManageStudentRecords({ user: caller }),
        theSeatDetailOf({ user: target }).is({ detail }),
        Profiling._getProfileFields({ user: target }).is({ displayName }),
      )
        .then(respond({ detail, displayName }))
        .named("found"),
      where(
        activeUser({ session }).is({ user: caller }),
        mayManageStudentRecords({ user: caller }),
        no(theSeatDetailOf({ user: target })),
      )
        .then(respond({ detail: null, displayName: null }))
        .named("missing"),
      where(
        activeUser({ session }).is({ user: caller }),
        mayNotManageStudentRecords({ user: caller }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  { input: { required: ["session", "user"] } },
);
