import { activeUser } from "../access/session.ts";
import {
  compute,
  each,
  former,
  no,
  reaction,
  when,
  where,
  now,
} from "@mit-sdg/sync-engine/language";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { belongsToList, doesNotBelongToList } from "./policy.ts";
import { TASK_LIST_MEMBER_CAPABILITIES, TASK_LIST_MEMBER_ROLE } from "./capabilities.ts";
import { theTasksIn } from "./tasks.ts";
import { computations, concepts } from "../../concepts.ts";

const { Profiling, Tasking, TaskListMembership, TaskLists } = concepts;

/** What is this task list, for whom, and who is still in it? */
export const theTaskList = former(
  "the task list (list) at (at)",
  ({ list, at }, { key, description, roster, member, memberName, present, openTask }) =>
    where(
      TaskLists._getCategoryDetail({ category: list }).is({ name: key, description }),
      compute(computations.taskListMembers, { key }, roster),
    ).form({
      list,
      title: description,
      members: each(
        Profiling._getProfilesOf({ users: roster }).is({ user: member, displayName: memberName }),
      ).form({ user: member, displayName: memberName }),
      present: each(
        TaskListMembership._getHoldersOfRoleNamed({
          context: list,
          name: TASK_LIST_MEMBER_ROLE,
        }).is({ user: present }),
      ).form({ user: present }),
      openTasks: each(TaskLists._getItems({ category: list }).is({ item: openTask }))
        .where(Tasking._getTask({ task: openTask, at }).is({ state: "OPEN" }))
        .count(),
    }),
).optional();

/** Which task lists does this profile still belong to? */
export const theTaskListsOf = former(
  "the task lists of (user) at (at)",
  ({ user, at }, { list, key, description, roster, member, memberName, present, openTask }) =>
    each(
      TaskListMembership._getContextsOfRoleNamed({ user, name: TASK_LIST_MEMBER_ROLE }).is({
        context: list,
      }),
    )
      .where(
        TaskLists._getCategoryDetail({ category: list }).is({ name: key, description }),
        compute(computations.taskListMembers, { key }, roster),
      )
      .form({
        list,
        title: description,
        members: each(
          Profiling._getProfilesOf({ users: roster }).is({ user: member, displayName: memberName }),
        ).form({ user: member, displayName: memberName }),
        present: each(
          TaskListMembership._getHoldersOfRoleNamed({
            context: list,
            name: TASK_LIST_MEMBER_ROLE,
          }).is({ user: present }),
        ).form({ user: present }),
        openTasks: each(TaskLists._getItems({ category: list }).is({ item: openTask }))
          .where(Tasking._getTask({ task: openTask, at }).is({ state: "OPEN" }))
          .count(),
      }),
);

export const OpenedTaskListAdmitsItsMembers = reaction(({ key, list, roster, member, role }) =>
  when(TaskLists.ensureCategory({ name: key }).responds({ category: list }))
    .where(
      compute(computations.taskListMembers, { key }, roster),
      Profiling._getProfilesOf({ users: roster }).is({ user: member }),
      TaskListMembership._getRoleByName({ name: TASK_LIST_MEMBER_ROLE }).is({ role }),
    )
    .then(TaskListMembership.ensureGrant({ user: member, context: list, role })),
);

export const ExtendedTaskListAdmitsItsMembers = reaction(({ key, list, roster, member, role }) =>
  when(TaskLists.renameCategory({ name: key }).responds({ category: list }))
    .where(
      compute(computations.taskListMembers, { key }, roster),
      Profiling._getProfilesOf({ users: roster }).is({ user: member }),
      TaskListMembership._getRoleByName({ name: TASK_LIST_MEMBER_ROLE }).is({ role }),
    )
    .then(TaskListMembership.ensureGrant({ user: member, context: list, role })),
);

export const LeftMemberReleasesOpenTasks = reaction(({ user, context, task, at }) =>
  when(TaskListMembership.revoke({ user, context }).responds({}))
    .where(
      now(at),
      TaskLists._getItems({ category: context }).is({ item: task }),
      Tasking._getTask({ task, at }).is({ assignee: user, state: "OPEN" }),
    )
    .then(Tasking.release({ task, at })),
);

export const OpenList = endpoint(
  "/tasklists/open",
  ({ session, members, title, key, role, list }) =>
    receive({ session, members, title })
      .where(activeUser({ session }), compute(computations.taskListKey, { members }, key))
      .then(
        TaskListMembership.ensureRole({
          name: TASK_LIST_MEMBER_ROLE,
          capabilities: TASK_LIST_MEMBER_CAPABILITIES,
        }).responds({ role }),
      )
      .then(
        TaskLists.ensureCategory({ name: key, description: title }).responds({ category: list }),
      )
      .then(respond({ list })),
  { input: { required: ["session", "members"], defaults: { title: "" } } },
);

export const ExtendList = endpoint(
  "/tasklists/extend",
  ({ session, list, members, user, held, enlarged, extended }) =>
    receive({ session, list, members }).then(
      where(
        activeUser({ session }).is({ user }),
        belongsToList({ user, list }),
        TaskLists._getCategoryDetail({ category: list }).is({ name: held }),
        compute(computations.taskListExtension, { key: held, members }, enlarged),
      )
        .then(
          TaskLists.renameCategory({ category: list, name: enlarged }).responds({
            category: extended,
          }),
        )
        .then(respond({ list: extended }))
        .named("success"),
      where(
        activeUser({ session }).is({ user }),
        belongsToList({ user, list }),
        no(TaskLists._getCategoryDetail({ category: list })),
      )
        .then(respond({ error: "NOT_FOUND" }))
        .named("missing"),
      where(activeUser({ session }).is({ user }), doesNotBelongToList({ user, list }))
        .then(respond({ error: "FORBIDDEN" }))
        .named("forbidden"),
    ),
);

export const LeaveList = endpoint("/tasklists/leave", ({ session, list, user, role }) =>
  receive({ session, list }).then(
    where(
      activeUser({ session }).is({ user }),
      belongsToList({ user, list }),
      TaskListMembership._getRoleByName({ name: TASK_LIST_MEMBER_ROLE }).is({ role }),
    )
      .then(TaskListMembership.revoke({ user, context: list, role }).responds({}))
      .then(respond({ list }))
      .named("success"),
    where(activeUser({ session }).is({ user }), doesNotBelongToList({ user, list }))
      .then(respond({ error: "FORBIDDEN" }))
      .named("forbidden"),
  ),
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
