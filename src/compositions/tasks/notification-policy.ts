import { compute, is, view, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts } from "../../concepts.ts";

const { Grouping, Tasking } = concepts;

/**
 * A member who removed somebody else is still on the roster afterwards; a member who
 * removed themselves is not. Nothing records who acted, so the roster answers it.
 */
export const removedSomebodyElse = view(
  "(member) removed somebody else from (list)",
  ({ member, list }, _outputs, _bindings) =>
    where(Grouping._isMember({ group: list, member }).is({ isMember: true })),
).holds();

/**
 * Which finished subject line, text, and HTML does this entry deserve? A membership entry
 * resolves through the group read, a task entry through the task read, and an entry that
 * resolves through neither renders nothing at all.
 */
export const theMailFor = view(
  "the task notification mail of kind (kind) about (subject) for (recipient) at (at)",
  (
    { kind, subject, recipient, at },
    { mailSubject, text, html },
    { listTitle, taskTitle, list, deadline },
  ) => [
    where(
      Grouping._getGroup({ group: subject }).is({ title: listTitle }),
      compute(computations.taskListMailSubject, { kind, listTitle }, mailSubject),
      compute(computations.taskListMailText, { kind, listTitle }, text),
      compute(computations.taskListMailHtml, { kind, listTitle }, html),
    ),
    where(
      Tasking._getTask({ task: subject, at }).is({
        title: taskTitle,
        scope: list,
        endsAt: deadline,
      }),
      Grouping._getGroup({ group: list }).is({ title: listTitle }),
      Grouping._isMember({ group: list, member: recipient }).is({ isMember: true }),
      compute(computations.taskMailSubject, { kind, taskTitle, listTitle }, mailSubject),
      compute(computations.taskMailText, { kind, taskTitle, listTitle, deadline }, text),
      compute(computations.taskMailHtml, { kind, taskTitle, listTitle, deadline }, html),
    ),
  ],
).optional();

/**
 * Which list title may this reader see behind this entry? A membership entry resolves the
 * list itself, a task entry the list holding it, and a membership-loss entry keeps its title
 * even though its reader has by construction left. Which of the two reads resolves the
 * subject decides what kind of entry it is; the kind string only relaxes the membership gate
 * for the one entry whose whole purpose is to name the list a person left.
 */
export const theListTitleBehind = view(
  "the list title behind (subject) of kind (kind) for (reader) at (at)",
  ({ subject, kind, reader, at }, { title }, { list }) => [
    where(
      Grouping._getGroup({ group: subject }).is({ title }),
      Grouping._isMember({ group: subject, member: reader }).is({ isMember: true }),
    ),
    where(
      Grouping._getGroup({ group: subject }).is({ title }),
      Grouping._isMember({ group: subject, member: reader }).is({ isMember: false }),
      is.among(kind, ["task-list-removed"]),
    ),
    where(
      Tasking._getTask({ task: subject, at }).is({ scope: list }),
      Grouping._getGroup({ group: list }).is({ title }),
      Grouping._isMember({ group: list, member: reader }).is({ isMember: true }),
    ),
  ],
).optional();

/** What does the task behind this entry look like, for a reader still in its list? */
export const theTaskBehind = view(
  "the task behind (subject) for (reader) at (at)",
  ({ subject, reader, at }, { list, title, details, startsAt, endsAt, state, assignee }, _free) =>
    where(
      Tasking._getTask({ task: subject, at }).is({
        scope: list,
        title,
        details,
        startsAt,
        endsAt,
        state,
        assignee,
      }),
      Grouping._isMember({ group: list, member: reader }).is({ isMember: true }),
    ),
).optional();

/**
 * Must somebody other than the person acting hear about a change to this task? Only when
 * the task records an assignee, that assignee still belongs to the list holding the task,
 * and the assignee is not the actor. Reading the roster for the recorded assignee also
 * settles that there is one at all: nobody is a member under a missing assignee.
 */
export const somebodyMustHearAbout = view(
  "somebody other than (actor) must hear about (task) at (at)",
  ({ task, actor, at }, _outputs, { list, assignee }) =>
    where(
      Tasking._getTask({ task, at }).is({ scope: list }),
      Grouping._getMembers({ group: list }).is({ member: assignee }),
      Tasking._getTask({ task, at }).is({ assignee }),
      Tasking._getTask({ task, at }).is.not({ assignee: actor }),
    ),
).holds();
