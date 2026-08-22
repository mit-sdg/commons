import type { Output } from "./api";

type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

export type ConversationSummary = ArrayElement<
  Output<"/threads/latest">["conversations"]
>;

export type ThreadNode = ArrayElement<Output<"/threads/get">["thread"]>;

export type PostView = Output<"/posts/get">["post"];

export type Me = Output<"/auth/me">;

export type Profile = Output<"/profiles/get">["profile"];

export type Reaction = ArrayElement<
  Output<"/reactions/forTarget">["reactions"]
>;
export type Tag = ArrayElement<Output<"/tags/forTarget">["tags"]>;
export type Category = ArrayElement<Output<"/categories/list">["categories"]>;
export type Notification = ArrayElement<
  Output<"/notifications/list">["notifications"]
>;
export type InboxNotification = ArrayElement<
  Output<"/notifications/inbox">["notifications"]
>;
/** A row of the task domain's own inbox, served by the second Notifying instance. */
export type TaskInboxNotification = ArrayElement<
  Output<"/tasknotifications/inbox">["notifications"]
>;
export type Flag = ArrayElement<Output<"/flags/forTarget">["flags"]>;
export type OpenFlag = ArrayElement<Output<"/flags/open">["targets"]>;
export type TrashedItem = ArrayElement<Output<"/trash/list">["trashed"]>;
export type Bookmark = ArrayElement<Output<"/bookmarks/list">["bookmarks"]>;
export type Subscription = ArrayElement<
  Output<"/subscriptions/mine">["subscriptions"]
>;
export type Revision = ArrayElement<Output<"/revisions/list">["revisions"]>;
export type LockedTarget = ArrayElement<Output<"/locks/list">["locked"]>;
export type PinnedItem = ArrayElement<Output<"/pins/forScope">["pinned"]>;
export type RoleRow = ArrayElement<Output<"/roles/forUser">["roles"]>;
export type RoleDetail = Output<"/roles/get">;
export type RoleSummary = ArrayElement<Output<"/roles/list">["roles"]>;

export type TaskList = ArrayElement<Output<"/tasklists/mine">["lists"]>;
export type TaskListDetail = NonNullable<Output<"/tasklists/get">["list"]>;
export type Task = ArrayElement<Output<"/tasklists/get">["tasks"]>;
export type AssignedTask = ArrayElement<Output<"/tasks/mine">["tasks"]>;
export interface TaskListPage {
  list: Output<"/tasklists/get">["list"];
  tasks: Task[];
}

export type ID = string;
