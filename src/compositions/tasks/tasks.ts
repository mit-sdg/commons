import { activeUser } from "../access/session.ts";
import { each, former, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import {
  belongsToList,
  doesNotBelongToList,
  mayActOnTask,
  mayNotActOnTask,
  theListHolding,
} from "./policy.ts";
import { TASK_LIST_MEMBER_CAPABILITY } from "./capabilities.ts";
import { concepts } from "../../concepts.ts";

const { Tasking, TaskListMembership, TaskLists } = concepts;

/** What work does this list hold, soonest deadline first? */
export const theTasksIn = former(
  "the tasks in (list) at (at)",
  (
    { list, at },
    { task, title, details, startsAt, endsAt, assignee, state, overdue, createdAt, updatedAt },
  ) =>
    each(TaskLists._getItems({ category: list }).is({ item: task }))
      .where(
        Tasking._getTask({ task, at }).is({
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
        TaskLists._getCategory({ item: task }).is({ category: list, description: listTitle }),
        TaskListMembership._hasCapability({
          user,
          context: list,
          capability: TASK_LIST_MEMBER_CAPABILITY,
        }).is({ allowed: true }),
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
          Tasking.create({ title, details, startsAt, endsAt, assignee: null, at }).responds({
            task,
          }),
        )
        .then(TaskLists.assign({ item: task, category: list }))
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

export const RetimeTask = endpoint(
  "/tasks/retime",
  ({ session, task, startsAt, endsAt, user, at, retimed }) =>
    receive({ session, task, startsAt, endsAt }).then(
      where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task }))
        .then(Tasking.retime({ task, startsAt, endsAt, at }).responds({ task: retimed }))
        .then(respond({ task: retimed }))
        .named("success"),
      where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
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
        mayActOnTask({ user, task }),
        theListHolding({ task }).is({ list }),
        belongsToList({ user: assignee, list }),
      )
        .then(Tasking.assign({ task, assignee, at }).responds({ task: assigned }))
        .then(respond({ task: assigned }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        mayActOnTask({ user, task }),
        theListHolding({ task }).is({ list }),
        doesNotBelongToList({ user: assignee, list }),
      )
        .then(respond({ error: "FORBIDDEN" }))
        .named("assignee-outside-list"),
      where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const ReleaseTask = endpoint("/tasks/release", ({ session, task, user, at, released }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task }))
      .then(Tasking.release({ task, at }).responds({ task: released }))
      .then(respond({ task: released }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const CompleteTask = endpoint("/tasks/complete", ({ session, task, user, at, completed }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task }))
      .then(Tasking.complete({ task, at }).responds({ task: completed }))
      .then(respond({ task: completed }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const ReopenTask = endpoint("/tasks/reopen", ({ session, task, user, at, reopened }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task }))
      .then(Tasking.reopen({ task, at }).responds({ task: reopened }))
      .then(respond({ task: reopened }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const CancelTask = endpoint("/tasks/cancel", ({ session, task, user, at, canceled }) =>
  receive({ session, task }).then(
    where(now(at), activeUser({ session }).is({ user }), mayActOnTask({ user, task }))
      .then(Tasking.cancel({ task, at }).responds({ task: canceled }))
      .then(respond({ task: canceled }))
      .named("success"),
    where(activeUser({ session }).is({ user }), mayNotActOnTask({ user, task }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);

export const MyTasks = endpoint("/tasks/mine", ({ session, user, at }) =>
  receive({ session })
    .where(now(at), activeUser({ session }).is({ user }))
    .then(respond({ tasks: theTasksAssignedTo({ user, at }) })),
);
