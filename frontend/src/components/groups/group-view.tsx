"use client";

import {
  ArrowLeft,
  CalendarClock,
  ListChecks,
  LogOut,
  Pencil,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { GroupDiscussions } from "@/components/groups/group-discussions";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { ExpandAllDetails } from "@/components/tasks/expand-all-details";
import {
  MemberPicker,
  type PickedMember,
} from "@/components/tasks/member-picker";
import { NewTaskDialog } from "@/components/tasks/new-task";
import { TaskCard } from "@/components/tasks/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExpandedTasks } from "@/hooks/use-expanded-tasks";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TaskListPage } from "@/lib/models";
import { loadTaskListPage } from "@/lib/tasks";

interface Member {
  user: string;
  displayName: string;
}

function RenameListDialog({
  list,
  currentTitle,
  onRenamed,
}: {
  list: string;
  currentTitle: string;
  onRenamed: () => void;
}) {
  const [open, setOpen] = useState(false);
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
    setOpen(false);
    onRenamed();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          aria-label="Rename group"
          onClick={() => setTitle(currentTitle)}
        >
          <Pencil className="size-4" /> Rename group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-list-title">Group name</Label>
            <Input
              id="rename-list-title"
              value={title}
              disabled={busy}
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
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => void rename()}>
            {busy ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <Button variant="outline" size="sm" className="gap-1.5">
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

export function GroupView({
  list,
  tab = "discussions",
}: {
  list: string;
  tab?: "discussions" | "tasks" | "members";
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
    page.refetch();
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
        title={
          <div className="flex items-center gap-2">
            <span>
              {detail?.title ||
                (roster.length === 1
                  ? "Untitled group"
                  : roster.map((member) => member.displayName).join(", ")) ||
                "Group"}
            </span>
          </div>
        }
        actions={
          detail ? (
            <details className="relative">
              <summary className="cursor-pointer rounded-md border px-3 py-2 text-sm">
                Group settings
              </summary>
              <div className="absolute right-0 z-20 mt-2 grid w-44 gap-1 rounded-md border bg-popover p-2 shadow-md">
                {detail ? (
                  <RenameListDialog
                    list={list}
                    currentTitle={detail.title || ""}
                    onRenamed={page.refetch}
                  />
                ) : null}
                <ConfirmAction
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-1.5"
                    >
                      <LogOut className="size-4" /> Leave group
                    </Button>
                  }
                  title="Leave this group?"
                  description="Your open tasks will be released. Access to discussions through this group will end; another audience on a discussion may still give you access."
                  confirmLabel="Leave"
                  destructive
                  onConfirm={leave}
                />
              </div>
            </details>
          ) : null
        }
      />

      {page.loading && !page.data ? (
        <LoadingState />
      ) : page.error ? (
        <ErrorState message={page.error} onRetry={page.refetch} />
      ) : !detail ? (
        <EmptyState
          icon={ListChecks}
          title="This group is not available"
          description="You may not be a member of this group or it does not exist."
        />
      ) : (
        <div className="space-y-6">
          <nav aria-label="Group views" className="flex gap-1 border-b pb-2">
            {(["discussions", "tasks", "members"] as const).map((view) => (
              <Button
                asChild
                key={view}
                variant={tab === view ? "secondary" : "ghost"}
                size="sm"
              >
                <Link
                  aria-current={tab === view ? "page" : undefined}
                  href={`/groups/${list}?view=${view}`}
                >
                  {view[0].toUpperCase() + view.slice(1)}
                </Link>
              </Button>
            ))}
          </nav>
          {tab === "discussions" ? (
            <GroupDiscussions group={list} />
          ) : tab === "members" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Members</h2>
                <AddMemberDialog
                  list={list}
                  members={roster}
                  onChanged={page.refetch}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Members:
                </span>
                {roster.map((member) => (
                  <Badge
                    key={member.user}
                    variant="secondary"
                    className="gap-1.5 py-1 pr-1.5 pl-2.5 text-xs"
                  >
                    <span>{member.displayName}</span>
                    {member.user === viewer ? (
                      <span className="text-muted-foreground">(you)</span>
                    ) : (
                      <ConfirmAction
                        trigger={
                          <button
                            type="button"
                            aria-label={`Remove ${member.displayName}`}
                            className="rounded-full text-muted-foreground hover:text-destructive"
                          >
                            <UserMinus className="size-3" />
                          </button>
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
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Tasks</h2>
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
                        Active &amp; Overdue ({activeAndOverdue.length})
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
