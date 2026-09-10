"use client";

import { Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import {
  MemberPicker,
  type PickedMember,
} from "@/components/tasks/member-picker";
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
import { useQuery } from "@/hooks/use-query";
import { CommonsError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import type { TaskList } from "@/lib/models";
import { createTaskList, loadMyLists } from "@/lib/tasks";

function NewGroupDialog({
  me,
  myName,
  onOpened,
}: {
  me: string;
  myName: string;
  onOpened: (list: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<PickedMember[]>([]);
  const [busy, setBusy] = useState(false);
  const members = [{ user: me, displayName: myName }, ...chosen];

  async function create() {
    setBusy(true);
    try {
      const list = await createTaskList(
        title.trim(),
        chosen.map((member) => member.user),
      );
      setOpen(false);
      setTitle("");
      setChosen([]);
      toast.success("Group created");
      onOpened(list);
    } catch (error) {
      toast.error(
        error instanceof CommonsError
          ? error.message
          : "The group could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" /> Create group
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a group</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-list-title">Name</Label>
            <Input
              id="new-list-title"
              value={title}
              disabled={busy}
              placeholder="e.g. Team project"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <MemberPicker
            chosen={members}
            fixed={me}
            disabled={busy}
            onChange={(next) =>
              setChosen(next.filter((member) => member.user !== me))
            }
          />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !title.trim()}
            onClick={() => void create()}
          >
            {busy ? "Creating…" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GroupRow({ list }: { list: TaskList }) {
  const id = String(list.list);
  const members = list.members ?? [];
  return (
    <Link
      href={`/groups/${id}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {list.title ||
            members
              .map((member) => member.displayName)
              .join(", ")
              .slice(0, 80) ||
            "Untitled group"}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {members.length === 1
            ? "Just you"
            : members.map((member) => member.displayName).join(", ")}
        </p>
      </div>
      <span className="shrink-0 text-sm text-muted-foreground">
        {count(list.openTasks ?? 0, "open task")}
      </span>
    </Link>
  );
}

function Groups() {
  const { me, session } = useAuth();
  const router = useRouter();
  const groups = useQuery(session ? loadMyLists : null, [session]);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Your work"
        title="Groups"
        description="The people you share task lists with."
        actions={
          me ? (
            <NewGroupDialog
              me={me.user}
              myName={me.profile.displayName}
              onOpened={(group) => router.push(`/groups/${group}`)}
            />
          ) : null
        }
      />
      {groups.loading && !groups.data ? (
        <LoadingState />
      ) : groups.error ? (
        <ErrorState message={groups.error} onRetry={groups.refetch} />
      ) : groups.data?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.data.map((group) => (
            <GroupRow key={group.list} list={group} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Create a group to share discussions and tasks."
        />
      )}
    </PageContainer>
  );
}
export default function GroupsPage() {
  return (
    <RequireAuth>
      <Groups />
    </RequireAuth>
  );
}
