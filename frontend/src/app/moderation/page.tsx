"use client";

import { Flag, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { PostPreview } from "@/components/forum/post-preview";
import { RevisionsDialog } from "@/components/forum/revisions-dialog";
import { Link } from "@/components/link";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserName } from "@/components/user-name";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shortId } from "@/lib/format";
import { loadPostConversationIndex } from "@/lib/loaders";
import type {
  Flag as FlagModel,
  LockedTarget,
  OpenFlag,
  TrashedItem,
} from "@/lib/models";

function FlagDetails({ target }: { target: string }) {
  const { session } = useAuth();
  const { data } = useQuery<{ flags: FlagModel[] }>(
    session ? () => api.flags.forTarget({ target }) : null,
    [session, target],
  );
  const open = (data?.flags ?? []).filter((f) => f.status === "open");
  if (open.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
      {open.map((f) => (
        <Facts as="li" key={String(f.flag)} className="text-muted-foreground">
          <span>
            <UserName user={String(f.reporter)} className="text-foreground" />{" "}
            flagged this — <span className="italic">“{f.reason}”</span>
          </span>
          <Fact.When at={f.createdAt} />
        </Facts>
      ))}
    </ul>
  );
}

function FlagsQueue() {
  const { session } = useAuth();
  const { data, error, loading, refetch } = useQuery<{ targets: OpenFlag[] }>(
    session ? () => api.flags.open({}) : null,
    [session],
  );
  const flagItems = (data?.targets ?? []).map(({ target }) => String(target));
  const flagIndexKey = flagItems.join("\u0000");
  const index = useQuery<Record<string, string>>(
    flagItems.length > 0 ? () => loadPostConversationIndex(flagItems) : null,
    [flagIndexKey],
  );

  async function resolve(target: string, outcome: "upheld" | "dismissed") {
    if (!session) return;
    const result = await api.flags.resolve({ target, outcome });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Flag ${outcome}`);
      refetch();
    }
  }

  async function trash(item: string) {
    if (!session) return;
    const result = await api.trash.trash({ item });
    if ("error" in result)
      toast.error(
        result.error === "CONFLICT"
          ? "This is a thread's opening post. Move the whole thread to trash from its page."
          : publicErrorMessage(result.error),
      );
    else {
      toast.success("Post moved to trash");
      refetch();
    }
  }

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.targets.length === 0)
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Queue is clear"
        description="There are no open flags to review."
      />
    );

  return (
    <div className="space-y-4">
      {data.targets.map(({ target, count }) => {
        const item = String(target);
        return (
          <PostPreview
            key={item}
            item={item}
            conversation={index.data?.[item] ?? null}
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                <Flag className="size-3" />
                {count}
              </span>
            }
            meta={
              <div>
                <FlagDetails target={item} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolve(item, "upheld")}
                  >
                    Uphold
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolve(item, "dismissed")}
                  >
                    Dismiss
                  </Button>
                  <ConfirmAction
                    title="Move this post to trash?"
                    description="Its text is hidden and its place in the discussion shows as removed. Replies to it stay visible. A thread's opening post is moved to trash with its whole thread from the thread page."
                    confirmLabel="Move to trash"
                    destructive
                    onConfirm={() => trash(item)}
                    trigger={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-destructive"
                      >
                        <Trash2 className="size-4" />
                        Move to trash
                      </Button>
                    }
                  />
                </div>
              </div>
            }
          />
        );
      })}
    </div>
  );
}

function LockedTopics() {
  const { session } = useAuth();
  const { data, error, loading, refetch } = useQuery<{
    locked: LockedTarget[];
  }>(() => api.locks.list({}), []);

  async function unlock(target: string) {
    if (!session) return;
    const result = await api.locks.unlock({ target });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Topic unlocked");
      refetch();
    }
  }

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.locked.length === 0)
    return (
      <EmptyState
        icon={Lock}
        title="No locked topics"
        description="Locked conversations will appear here."
      />
    );

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {data.locked.map((lock) => {
        const target = String(lock.target);
        return (
          <div
            key={target}
            className="flex items-center justify-between gap-3 p-4"
          >
            <div>
              <Link
                href={`/t/${target}`}
                className="font-medium hover:text-primary"
              >
                Conversation {shortId(target)}
              </Link>
              <Fact.When
                at={lock.lockedAt}
                verb="Locked"
                className="block text-xs"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => unlock(target)}>
              Unlock
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function TrashBin() {
  const { session } = useAuth();
  const { data, error, loading, refetch } = useQuery<{
    trashed: TrashedItem[];
  }>(() => api.trash.list({}), [session]);

  async function restore(entry: TrashedItem) {
    if (!session) return;
    const result = await api.trash.restore({ item: String(entry.item) });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(entry.thread ? "Thread restored" : "Reply restored");
      refetch();
    }
  }

  async function purge(entry: TrashedItem) {
    if (!session) return;
    const result = await api.trash.purge({ item: String(entry.item) });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(
        entry.thread
          ? "Thread permanently deleted"
          : "Reply permanently deleted",
      );
      refetch();
    }
  }

  if (loading && !data) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.trashed.length === 0)
    return (
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Threads and replies in trash can be restored or permanently deleted from here."
      />
    );

  return (
    <div className="space-y-4">
      {data.trashed.map((entry) => {
        const item = String(entry.item);
        // A thread entry previews its opening post; the actions still target the thread.
        const preview = entry.thread ? String(entry.opening ?? item) : item;
        return (
          <PostPreview
            key={item}
            item={preview}
            moderator
            meta={
              <span>
                {entry.thread ? (
                  <Badge variant="secondary" className="mr-2">
                    Whole thread
                  </Badge>
                ) : null}
                Trashed by{" "}
                <UserName
                  user={String(entry.trashedBy)}
                  className="text-foreground"
                />{" "}
                <Fact.When at={entry.trashedAt} />
              </span>
            }
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <RevisionsDialog item={preview} moderator />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore(entry)}
                >
                  Restore
                </Button>
                <ConfirmAction
                  title={
                    entry.thread
                      ? "Permanently delete this thread?"
                      : "Permanently delete this reply?"
                  }
                  description={
                    entry.thread
                      ? "Every post in the thread is deleted. This cannot be undone."
                      : "The reply's text is deleted and its place in the discussion stays marked as removed. Replies to it stay visible. This cannot be undone."
                  }
                  confirmLabel="Delete permanently"
                  destructive
                  onConfirm={() => purge(entry)}
                  trigger={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                    >
                      Delete permanently
                    </Button>
                  }
                />
              </div>
            }
          />
        );
      })}
    </div>
  );
}

export default function ModerationPage() {
  const { loading, permissions } = useAuth();

  if (loading)
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );

  if (!permissions.can("moderate"))
    return (
      <PageContainer>
        <EmptyState
          icon={ShieldCheck}
          title="Moderators only"
          description="You don't have permission to view the moderation tools."
        />
      </PageContainer>
    );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Moderation"
        description="Review flagged content, manage locked topics, and manage posts in trash."
      />
      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">Flag queue</TabsTrigger>
          <TabsTrigger value="locked">Locked</TabsTrigger>
          <TabsTrigger value="trash">Trash</TabsTrigger>
        </TabsList>
        <TabsContent value="flags" className="mt-6">
          <FlagsQueue />
        </TabsContent>
        <TabsContent value="locked" className="mt-6">
          <LockedTopics />
        </TabsContent>
        <TabsContent value="trash" className="mt-6">
          <TrashBin />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
