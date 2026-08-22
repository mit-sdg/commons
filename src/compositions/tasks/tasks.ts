import { activeUser } from "../access/session.ts";
import { each, former, now, where } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  belongsToList,
  doesNotBelongToList,
  mayActOnTask,
  mayNotActOnTask,
  theListHolding,
} from "./policy.ts";
import { concepts } from "../../concepts.ts";

const { Grouping, Tasking } = concepts;

/** What work does this list hold, soonest deadline first? */
export const theTasksIn = former(
  "the tasks in (list) at (at)",
  (
    { list, at },
    { task, title, details, startsAt, endsAt, assignee, state, overdue, createdAt, updatedAt },
  ) =>
    each(
      Tasking._getTasksInScope({ scope: list, at }).is({
        task,
        title,
        details,
        startsAt,
        endsAt,
        assignee,
        state,
        overdue,
        createdAt,
        updatedAt,
      }),
    )
      .arranged(endsAt)
      .form({
        task,
        title,
        details,
        startsAt,
        endsAt,
        assignee,
        state,
        overdue,
        createdAt,
        updatedAt,
      }),
);

/** What is assigned to this profile across every list it still belongs to? */
export const theTasksAssignedTo = former(
  "the tasks assigned to (user) at (at)",
  (
    { user, at },
    {
      task,
      title,
      details,
      startsAt,
      endsAt,
      state,
      overdue,
      createdAt,
      updatedAt,
      list,
      listTitle,
    },
  ) =>
    each(
      Tasking._getAssigned({ assignee: user, at }).is({
        task,
        scope: list,
        title,
        details,
        startsAt,
        endsAt,
        state,
        overdue,
        createdAt,
        updatedAt,
      }),
    )
      .where(
        Grouping._getGroup({ group: list }).is({ title: listTitle }),
        Grouping._isMember({ group: list, member: user }).is({ isMember: true }),
      )
      .arranged(endsAt)
      .form({
        task,
        list,
        listTitle,
        title,
        details,
        startsAt,
        endsAt,
        state,
        overdue,
        createdAt,
        updatedAt,
      }),
);

export const CreateTask = endpoint(
  "/tasks/create",
  ({ session, list, title, details, startsAt, endsAt, user, at, task }) =>
    receive({ session, list, title, details, startsAt, endsAt }).then(
      where(now(at), activeUser({ session }).is({ user }), belongsToList({ user, list }))
        .then(
          Tasking.create({
            scope: list,
            title,
            details,
            startsAt,
            endsAt,
            assignee: null,
            at,
          }).responds({
            task,
          }),
        )
        .then(respond({ task }))
        .named("success"),
      where(activeUser({ session }).is({ user }), doesNotBelongToList({ user, list }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "list", "title", "startsAt", "endsAt"],
      defaults: { details: "" },
    },
  },
);

export const DescribeTask = endpoint(
  "/tasks/describe",
  ({ session, task, title, details, user, at, described }) =>
    receive({ session, task, title, details }).then(
      where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
        .then(Tasking.describe({ task, title, details, at }).responds({ task: described }))
        .then(respond({ task: described }))
        .named("success"),
      where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
  {
    input: {
      required: ["session", "task", "title"],
      defaults: { details: "" },
    },
  },
);

export const RetimeTask = endpoint(
  "/tasks/retime",
  ({ session, task, startsAt, endsAt, user, at, retimed }) =>
    receive({ session, task, startsAt, endsAt }).then(
      where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
        .then(Tasking.retime({ task, startsAt, endsAt, at }).responds({ task: retimed }))
        .then(respond({ task: retimed }))
        .named("success"),
      where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const AssignTask = endpoint(
  "/tasks/assign",
  ({ session, task, assignee, user, at, list, assigned }) =>
    receive({ session, task, assignee }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayActOnTask({ user, task, at }),
        theListHolding({ task, at }).is({ list }),
        belongsToList({ user: assignee, list }),
      )
        .then(Tasking.assign({ task, assignee, at }).responds({ task: assigned }))
        .then(respond({ task: assigned }))
        .named("success"),
      where(
        now(at),
        activeUser({ session }).is({ user }),
        mayActOnTask({ user, task, at }),
        theListHolding({ task, at }).is({ list }),
        doesNotBelongToList({ user: assignee, list }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("assignee-outside-list"),
      where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ReleaseTask = endpoint("/tasks/release", ({ session, task, user, at, released }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
      .then(Tasking.release({ task, at }).responds({ task: released }))
      .then(respond({ task: released }))
      .named("success"),
    where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const CompleteTask = endpoint("/tasks/complete", ({ session, task, user, at, completed }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
      .then(Tasking.complete({ task, at }).responds({ task: completed }))
      .then(respond({ task: completed }))
      .named("success"),
    where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const ReopenTask = endpoint("/tasks/reopen", ({ session, task, user, at, reopened }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
      .then(Tasking.reopen({ task, at }).responds({ task: reopened }))
      .then(respond({ task: reopened }))
      .named("success"),
    where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const CancelTask = endpoint("/tasks/cancel", ({ session, task, user, at, canceled }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task, at }))
      .then(Tasking.cancel({ task, at }).responds({ task: canceled }))
      .then(respond({ task: canceled }))
      .named("success"),
    where(now(at), activeUser({ session }).is({ user }), mayNotActOnTask({ user, task, at }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const MyTasks = endpoint("/tasks/mine", ({ session, user, at }) =>
  receive({ session })
    .where(now(at), activeUser({ session }).is({ user }))
    .then(respond({ tasks: theTasksAssignedTo({ user, at }) })),
);
