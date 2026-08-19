import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";
import { TASK_LIST_MEMBER_CAPABILITY } from "./capabilities.ts";

const { TaskListMembership, TaskLists } = concepts;

export const belongsToList = view(
  "(user) belongs to task list (list)",
  ({ user, list }, _outputs, _bindings) =>
    where(
      TaskListMembership._hasCapability({
        user,
        context: list,
        capability: TASK_LIST_MEMBER_CAPABILITY,
      }).is({ allowed: true }),
    ),
).holds();

export const doesNotBelongToList = view(
  "(user) does not belong to task list (list)",
  ({ user, list }, _outputs, _bindings) =>
    where(
      TaskListMembership._hasCapability({
        user,
        context: list,
        capability: TASK_LIST_MEMBER_CAPABILITY,
      }).is({ allowed: false }),
    ),
).holds();

/** Which list holds this task? Membership runs from the list to the task. */
export const theListHolding = view(
  "the task list holding (task)",
  ({ task }, { list }, _bindings) =>
    where(TaskLists._getCategory({ item: task }).is({ category: list })),
).optional();

export const mayActOnTask = view(
  "(user) may act on task (task)",
  ({ user, task }, _outputs, { list }) =>
    where(
      TaskLists._getCategory({ item: task }).is({ category: list }),
      TaskListMembership._hasCapability({
        user,
        context: list,
        capability: TASK_LIST_MEMBER_CAPABILITY,
      }).is({ allowed: true }),
    ),
).holds();

export const mayNotActOnTask = view(
  "(user) may not act on task (task)",
  ({ user, task }, _outputs, { list }) => [
    where(
      TaskLists._getCategory({ item: task }).is({ category: list }),
      TaskListMembership._hasCapability({
        user,
        context: list,
        capability: TASK_LIST_MEMBER_CAPABILITY,
      }).is({ allowed: false }),
    ),
    where(no(TaskLists._getCategory({ item: task }))),
  ],
).holds();
