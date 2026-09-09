import { compute, is, no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts, computations } from "../../concepts.ts";

const { Authenticating, Grouping, Tasking } = concepts;

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

/** A task scope is either the actor's own account or a group they belong to. */
export const mayUseTaskScope = view(
  "(user) may use task scope (list)",
  ({ user, list }, _outputs, { owned }) => [
    where(
      Authenticating._getById({ user }),
      compute(computations.ownsTaskScope, { user, scope: list }, owned),
      is.among(owned, [true]),
    ),
    where(belongsToList({ user, list })),
  ],
).holds();

export const mayNotUseTaskScope = view(
  "(user) may not use task scope (list)",
  ({ user, list }, _outputs, _bindings) => where(no(mayUseTaskScope({ user, list }))),
).holds();

/** Which list holds this task? Membership runs from the list to the task. */
export const theListHolding = view(
  "the task list holding (task) at (at)",
  ({ task, at }, { list }, _bindings) => where(Tasking._getTask({ task, at }).is({ scope: list })),
).optional();

export const mayActOnTask = view(
  "(user) may act on task (task) at (at)",
  ({ user, task, at }, _outputs, { list }) =>
    where(Tasking._getTask({ task, at }).is({ scope: list }), mayUseTaskScope({ user, list })),
).holds();

export const mayNotActOnTask = view(
  "(user) may not act on task (task) at (at)",
  ({ user, task, at }, _outputs, { list }) => [
    where(Tasking._getTask({ task, at }).is({ scope: list }), mayNotUseTaskScope({ user, list })),
    where(no(Tasking._getTask({ task, at }))),
  ],
).holds();
