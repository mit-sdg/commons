import { activeUser } from "../access/session.ts";
import { each, former, no, reaction, when, where, now } from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { belongsToList, doesNotBelongToList } from "./policy.ts";
import { theTasksIn } from "./tasks.ts";
import { concepts } from "../../concepts.ts";

const { Grouping, Profiling, Tasking } = concepts;

/** What is this task list, for whom, and who is still in it? */
export const theTaskList = former(
  "the task list (list) at (at)",
  ({ list, at }, { title, member, memberName, openTask }) =>
    where(Grouping._getGroup({ group: list }).is({ title })).form({
      list,
      title,
      members: each(Grouping._getMembers({ group: list }).is({ member }))
        .where(Profiling._getProfileFields({ user: member }).is({ displayName: memberName }))
        .form({ user: member, displayName: memberName }),
      openTasks: each(
        Tasking._getTasksInScope({ scope: list, at }).is({ task: openTask, state: "OPEN" }),
      ).count(),
    }),
).optional();

/** Which task lists does this profile belong to? */
export const theTaskListsOf = former(
  "the task lists of (user) at (at)",
  ({ user, at }, { list, title, member, memberName, openTask }) =>
    each(Grouping._getGroupsOf({ member: user }).is({ group: list, title })).form({
      list,
      title,
      members: each(Grouping._getMembers({ group: list }).is({ member }))
        .where(Profiling._getProfileFields({ user: member }).is({ displayName: memberName }))
        .form({ user: member, displayName: memberName }),
      openTasks: each(
        Tasking._getTasksInScope({ scope: list, at }).is({ task: openTask, state: "OPEN" }),
      ).count(),
    }),
);

export const LeftMemberReleasesOpenTasks = reaction(({ user, group, task, at }) =>
  when(Grouping.leave({ member: user }).responds({ group }))
    .where(
      now(at),
      Tasking._getTasksInScope({ scope: group, at }).is({ task, assignee: user, state: "OPEN" }),
    )
    .then(Tasking.release({ task, at })),
);

export const RemovedMemberReleasesOpenTasks = reaction(({ target, group, task, at }) =>
  when(Grouping.removeMember({ target }).responds({ group }))
    .where(
      now(at),
      Tasking._getTasksInScope({ scope: group, at }).is({ task, assignee: target, state: "OPEN" }),
    )
    .then(Tasking.release({ task, at })),
);

export const CreateList = endpoint(
  "/tasklists/create",
  ({ session, title, user, at, list }) =>
    receive({ session, title })
      .where(now(at), activeUser({ session }).is({ user }))
      .then(Grouping.create({ title, creator: user, at }).responds({ group: list }))
      .then(respond({ list })),
  { input: { required: ["session"], defaults: { title: "" } } },
);

export const RenameList = endpoint(
  "/tasklists/rename",
  ({ session, list, title, user, at, renamed }) =>
    receive({ session, list, title })
      .where(now(at), activeUser({ session }).is({ user }))
      .then(Grouping.rename({ group: list, member: user, title, at }).responds({ group: renamed }))
      .then(respond({ list: renamed })),
  { input: { required: ["session", "list", "title"] } },
);

export const AddMember = endpoint(
  "/tasklists/add-member",
  ({ session, list, candidate, user, at, added }) =>
    receive({ session, list, candidate }).then(
      where(
        now(at),
        activeUser({ session }).is({ user }),
        Profiling._getProfile({ user: candidate }),
      )
        .then(
          Grouping.addMember({ group: list, member: user, candidate, at }).responds({
            group: added,
          }),
        )
        .then(respond({ list: added }))
        .named("success"),
      where(activeUser({ session }), no(Profiling._getProfile({ user: candidate })))
        .then(respond({ error: "NOT_FOUND" }))
        .named("profile-not-found"),
    ),
  { input: { required: ["session", "list", "candidate"] } },
);

export const RemoveMember = endpoint(
  "/tasklists/remove-member",
  ({ session, list, target, user, at, removed }) =>
    receive({ session, list, target })
      .where(now(at), activeUser({ session }).is({ user }))
      .then(
        Grouping.removeMember({ group: list, member: user, target, at }).responds({
          group: removed,
        }),
      )
      .then(respond({ list: removed })),
  { input: { required: ["session", "list", "target"] } },
);

export const LeaveList = endpoint(
  "/tasklists/leave",
  ({ session, list, user, at, left }) =>
    receive({ session, list })
      .where(now(at), activeUser({ session }).is({ user }))
      .then(Grouping.leave({ group: list, member: user, at }).responds({ group: left }))
      .then(respond({ list: left })),
  { input: { required: ["session", "list"] } },
);

export const MyLists = endpoint("/tasklists/mine", ({ session, user, at }) =>
  receive({ session })
    .where(now(at), activeUser({ session }).is({ user }))
    .then(respond({ lists: theTaskListsOf({ user, at }) })),
);

export const GetList = endpoint("/tasklists/get", ({ session, list, user, at }) =>
  receive({ session, list }).then(
    where(now(at), activeUser({ session }).is({ user }), belongsToList({ user, list }))
      .then(respond({ list: theTaskList({ list, at }), tasks: theTasksIn({ list, at }) }))
      .named("success"),
    where(activeUser({ session }).is({ user }), doesNotBelongToList({ user, list }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
);
