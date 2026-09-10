"use client";

import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ListChecks,
  LogOut,
  MessagesSquare,
  Pencil,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { GroupDiscussions } from "@/components/groups/group-discussions";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Tag } from "@/components/tag";
import { ExpandAllDetails } from "@/components/tasks/expand-all-details";
import {
  MemberPicker,
  type PickedMember,
} from "@/components/tasks/member-picker";
import { NewTaskDialog } from "@/components/tasks/new-task";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { useExpandedTasks } from "@/hooks/use-expanded-tasks";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TaskListPage } from "@/lib/models";
import { loadTaskListPage } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface Member {
  user: string;
  displayName: string;
}

type GroupTab = "discussions" | "tasks" | "members";

function RenameForm({
  list,
  currentTitle,
  onDone,
}: {
  list: string;
  currentTitle: string;
  onDone: (renamed: boolean) => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [busy, setBusy] = useState(false);

  async function rename() {
    if (title.trim() === "") {
      toast.error("Group name cannot be empty.");
      return;
    }
    setBusy(true);
    const result = await api.tasklists.rename({
      list,
      title: title.trim(),
    });
    setBusy(false);
    if ("error" in result) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    toast.success("Group renamed");
    onDone(true);
  }

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="rename-list-title">Group name</Label>
        <Input
          id="rename-list-title"
          value={title}
          disabled={busy}
          autoFocus
          placeholder="e.g. Project team"
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void rename();
            }
          }}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" disabled={busy} onClick={() => onDone(false)}>
          Cancel
        </Button>
        <Button disabled={busy} onClick={() => void rename()}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Everything that changes the group itself lives behind one menu, the same
 * overflow pattern task cards and the header use. Each choice opens its own
 * dialog, so the menu closes before the dialog takes focus.
 */
function GroupSettingsMenu({
  list,
  currentTitle,
  onRenamed,
  onLeave,
}: {
  list: string;
  currentTitle: string;
  onRenamed: () => void;
  onLeave: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Settings2 className="size-4" />
            Group settings
            <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setRenaming(true)}>
            <Pencil /> Rename group
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setLeaving(true)}
          >
            <LogOut /> Leave group
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
          </DialogHeader>
          <RenameForm
            list={list}
            currentTitle={currentTitle}
            onDone={(renamed) => {
              setRenaming(false);
              if (renamed) onRenamed();
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmAction
        open={leaving}
        onOpenChange={setLeaving}
        title="Leave this group?"
        description="Your open tasks will be released. Access to discussions through this group will end; another audience on a discussion may still give you access."
        confirmLabel="Leave"
        destructive
        onConfirm={onLeave}
      />
    </>
  );
}

function AddMemberDialog({
  list,
  members,
  onChanged,
}: {
  list: string;
  members: Member[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);

  async function addMembers() {
    if (chosen.length === 0) return;
    setBusy(true);
    let successCount = 0;
    for (const candidate of chosen) {
      const result = await api.tasklists["add-member"]({
        list,
        candidate: candidate.user,
      });
      if ("error" in result) {
        toast.error(publicErrorMessage(result.error));
      } else {
        successCount++;
      }
    }
    setBusy(false);
    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Member added to group"
          : `${successCount} members added to group`,
      );
      setChosen([]);
      setOpen(false);
      onChanged();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="size-4" /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add members to this group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <MemberPicker
            chosen={chosen}
            excluded={members.map((member) => member.user)}
            disabled={busy}
            label="Search and select members"
            onChange={(next) =>
              setChosen(
                next.filter(
                  (entry) =>
                    !members.some((member) => member.user === entry.user),
                ),
              )
            }
          />
          <p className="text-xs text-muted-foreground">
            New members can read earlier and future discussions addressed to
            this group, as well as its tasks. Every member can manage
            membership.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || chosen.length === 0}
            onClick={() => void addMembers()}
          >
            {busy ? "Adding…" : "Add to group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupTabs({
  list,
  current,
  counts,
}: {
  list: string;
  current: GroupTab;
  counts: Partial<Record<GroupTab, number>>;
}) {
  const tabs: { view: GroupTab; label: string; icon: typeof Users }[] = [
    { view: "discussions", label: "Discussions", icon: MessagesSquare },
    { view: "tasks", label: "Tasks", icon: ListChecks },
    { view: "members", label: "Members", icon: Users },
  ];
  return (
    <nav
      aria-label="Group views"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map(({ view, label, icon: Icon }) => {
        const active = current === view;
        const count = counts[view];
        return (
          <Link
            key={view}
            href={`/groups/${list}?view=${view}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {count !== undefined ? (
              <span
                aria-hidden="true"
                className={cn(
                  "rounded-full px-1.5 text-[0.7rem] tabular-nums",
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function MemberList({
  list,
  roster,
  viewer,
  onChanged,
}: {
  list: string;
  roster: Member[];
  viewer: string;
  onChanged: () => void;
}) {
  async function removeMember(targetUser: string, targetName: string) {
    const result = await api.tasklists["remove-member"]({
      list,
      target: targetUser,
    });
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "Cannot remove the only member from the group."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success(`${targetName} removed from group`);
    onChanged();
  }

  const sorted = [...roster].sort((a, b) =>
    a.user === viewer
      ? -1
      : b.user === viewer
        ? 1
        : a.displayName.localeCompare(b.displayName),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Members</h2>
        <AddMemberDialog list={list} members={roster} onChanged={onChanged} />
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {sorted.map((member) => {
          const isViewer = member.user === viewer;
          return (
            <li
              key={member.user}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
            >
              <UserAvatar
                user={member.user}
                name={member.displayName}
                className="size-8"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                <UserName
                  user={member.user}
                  name={member.displayName}
                  className="truncate"
                />
                {isViewer ? <Tag>You</Tag> : null}
              </div>
              {isViewer ? null : (
                <ConfirmAction
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${member.displayName}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  }
                  title={`Remove ${member.displayName}?`}
                  description={`${member.displayName}'s open tasks will be released. Their access to discussions through this group will end; another audience on a discussion may still give them access.`}
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() =>
                    removeMember(member.user, member.displayName)
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function GroupView({
  list,
  tab = "discussions",
}: {
  list: string;
  tab?: GroupTab;
}) {
  const router = useRouter();
  const { me, session } = useAuth();
  const viewer = me ? String(me.user) : "";

  const page = useQuery<TaskListPage>(
    session ? () => loadTaskListPage(list) : null,
    [session, list],
  );

  const detail = page.data?.list ?? null;
  const roster: Member[] = (detail?.members ?? []).map((member) => ({
    user: String(member.user),
    displayName: member.displayName,
  }));

  async function leave() {
    const result = await api.tasklists.leave({ list });
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "Cannot leave as the last member of the group."
          : publicErrorMessage(result.error),
      );
      return;
    }
    toast.success("You left the group");
    router.push("/groups");
  }

  const allTasks = useMemo(() => page.data?.tasks ?? [], [page.data]);
  const [now] = useState(() => Date.now());
  const expandable = useMemo(
    () =>
      allTasks
        .filter((task) => task.details?.trim())
        .map((task) => String(task.task)),
    [allTasks],
  );
  const details = useExpandedTasks(expandable);

  const openTasks = allTasks.filter((task) => task.state === "OPEN");
  const activeAndOverdue = openTasks
    .filter((task) => new Date(task.startsAt as string).getTime() <= now)
    .sort(
      (a, b) =>
        new Date(a.endsAt as string).getTime() -
        new Date(b.endsAt as string).getTime(),
    );

  const upcoming = openTasks
    .filter((task) => new Date(task.startsAt as string).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.endsAt as string).getTime() -
        new Date(b.endsAt as string).getTime(),
    );

  const settled = allTasks
    .filter((task) => task.state !== "OPEN")
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? (b.createdAt as string)).getTime() -
        new Date(a.updatedAt ?? (a.createdAt as string)).getTime(),
    );

  const title =
    detail?.title ||
    (roster.length === 1
      ? "Untitled group"
      : roster.map((member) => member.displayName).join(", ")) ||
    "Group";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link
            href="/groups"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> All groups
          </Link>
        }
        title={title}
        actions={
          detail ? (
            <GroupSettingsMenu
              list={list}
              currentTitle={detail.title || ""}
              onRenamed={page.refetch}
              onLeave={leave}
            />
          ) : null
        }
      />

      {page.loading && !page.data ? (
        <LoadingState />
      ) : page.error ? (
        <ErrorState
          message={page.error}
          refused={page.refused}
          onRetry={page.refetch}
        />
      ) : !detail ? (
        <EmptyState
          icon={ListChecks}
          title="This group is not available"
          description="You may not be a member of this group or it does not exist."
        />
      ) : (
        <div className="space-y-6">
          <GroupTabs
            list={list}
            current={tab}
            counts={{ tasks: openTasks.length, members: roster.length }}
          />
          {tab === "discussions" ? (
            <GroupDiscussions group={list} />
          ) : tab === "members" ? (
            <MemberList
              list={list}
              roster={roster}
              viewer={viewer}
              onChanged={page.refetch}
            />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Tasks</h2>
                <NewTaskDialog
                  scope={list}
                  scopeLabel={detail.title || "this group"}
                  onCreated={page.refetch}
                />
              </div>

              {allTasks.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="No tasks here yet"
                  description="Add one above. Set its start and deadline to organize upcoming work."
                />
              ) : (
                <div className="space-y-6">
                  <ExpandAllDetails details={details} />

                  {activeAndOverdue.length > 0 ? (
                    <section
                      className="space-y-3"
                      aria-label="Active and overdue"
                    >
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Active and overdue ({activeAndOverdue.length})
                      </h2>
                      {activeAndOverdue.map((task) => (
                        <TaskCard
                          key={String(task.task)}
                          expanded={details.isExpanded(String(task.task))}
                          onToggleExpanded={() =>
                            details.toggle(String(task.task))
                          }
                          task={task}
                          members={roster}
                          viewer={viewer}
                          onChanged={page.refetch}
                        />
                      ))}
                    </section>
                  ) : null}

                  {upcoming.length > 0 ? (
                    <section className="space-y-3" aria-label="Upcoming tasks">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        <CalendarClock className="size-4" />
                        Upcoming ({upcoming.length})
                      </h2>
                      {upcoming.map((task) => (
                        <TaskCard
                          key={String(task.task)}
                          expanded={details.isExpanded(String(task.task))}
                          onToggleExpanded={() =>
                            details.toggle(String(task.task))
                          }
                          task={task}
                          members={roster}
                          viewer={viewer}
                          onChanged={page.refetch}
                        />
                      ))}
                    </section>
                  ) : null}

                  {activeAndOverdue.length === 0 && upcoming.length === 0 ? (
                    <EmptyState
                      icon={ListChecks}
                      title="No open tasks"
                      description="All tasks in this group are completed or canceled."
                    />
                  ) : null}

                  {settled.length > 0 ? (
                    <section
                      className="space-y-3 pt-2"
                      aria-label="Settled tasks"
                    >
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Finished and canceled ({settled.length})
                      </h2>
                      {settled.map((task) => (
                        <TaskCard
                          key={String(task.task)}
                          expanded={details.isExpanded(String(task.task))}
                          onToggleExpanded={() =>
                            details.toggle(String(task.task))
                          }
                          task={task}
                          members={roster}
                          viewer={viewer}
                          onChanged={page.refetch}
                        />
                      ))}
                    </section>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
