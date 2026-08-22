import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concepts.ts";

const { Grouping, Tasking } = concepts;

export const belongsToList = view(
  "(user) belongs to task list (list)",
  ({ user, list }, _outputs, _bindings) =>
    where(
      Grouping._isMember({
        group: list,
        member: user,
      }).is({ isMember: true }),
    ),
).holds();

export const doesNotBelongToList = view(
  "(user) does not belong to task list (list)",
  ({ user, list }, _outputs, _bindings) =>
    where(
      Grouping._isMember({
        group: list,
        member: user,
      }).is({ isMember: false }),
    ),
).holds();

/** Which list holds this task? Membership runs from the list to the task. */
export const theListHolding = view(
  "the task list holding (task) at (at)",
  ({ task, at }, { list }, _bindings) => where(Tasking._getTask({ task, at }).is({ scope: list })),
).optional();

export const mayActOnTask = view(
  "(user) may act on task (task) at (at)",
  ({ user, task, at }, _outputs, { list }) =>
    where(
      Tasking._getTask({ task, at }).is({ scope: list }),
      Grouping._isMember({
        group: list,
        member: user,
      }).is({ isMember: true }),
    ),
).holds();

export const mayNotActOnTask = view(
  "(user) may not act on task (task) at (at)",
  ({ user, task, at }, _outputs, { list }) => [
    where(
      Tasking._getTask({ task, at }).is({ scope: list }),
      Grouping._isMember({
        group: list,
        member: user,
      }).is({ isMember: false }),
    ),
    where(no(Tasking._getTask({ task, at }))),
  ],
).holds();
