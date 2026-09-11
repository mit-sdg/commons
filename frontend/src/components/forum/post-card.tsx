"use client";

import {
  CheckCircle2,
  CornerUpLeft,
  Flag as FlagIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact } from "@/components/facts";
import { BookmarkButton } from "@/components/forum/bookmark-button";
import { Composer } from "@/components/forum/composer";
import { FlagDialog } from "@/components/forum/flag-dialog";
import { PinControl } from "@/components/forum/pin-control";
import { usePostControls } from "@/components/forum/post-controls-provider";
import { PostLinks } from "@/components/forum/post-links";
import { ReactionBar } from "@/components/forum/reaction-bar";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { RevisionsDialog } from "@/components/forum/revisions-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { UserName } from "@/components/user-name";
import { UserRole } from "@/components/user-role";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import type { ThreadNode } from "@/lib/models";
import { cn } from "@/lib/utils";

interface PostCardProps {
  node: ThreadNode;
  isRoot: boolean;
  questionId: string;
  rootAuthorId: string;
  acceptedAnswer: string | null;
  locked: boolean;
  scope: string;
  /** Visible posts beneath this one, so a moderator can trash the branch in one confirmation. */
  descendants?: string[];
  isUnread?: boolean;
  onChanged: () => void;
}

export function PostCard({
  node,
  isRoot,
  questionId,
  rootAuthorId,
  acceptedAnswer,
  locked,
  scope,
  descendants = [],
  isUnread = false,
  onChanged,
}: PostCardProps) {
  const { session, me, permissions } = useAuth();
  const router = useRouter();
  const [trashOpen, setTrashOpen] = useState(false);
  const [withReplies, setWithReplies] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);

  const postId = String(node.item);
  const nodeId = String(node.node);
  const author = String(node.post.author);
  const myId = me ? String(me.user) : null;
  const controls = usePostControls(postId);
  const sharedControls = controls?.data
    ? { data: controls.data, refetch: controls.refetch }
    : undefined;
  const controlsReady = !controls || !!sharedControls;
  const canModerate = permissions.can("moderate");
  const isMine = myId === author;
  const canAcceptAnswers = !!myId && myId === rootAuthorId && !isRoot;
  const isAccepted = acceptedAnswer === postId;
  const edited = !!node.post.editedAt;

  const highlightUnread = isUnread && !isAccepted;

  async function saveEdit(content: string) {
    if (!session) return;
    const result = await api.posts.edit({ post: postId, content });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Post updated");
      setEditing(false);
      onChanged();
    }
  }

  async function submitReply(content: string) {
    if (!session) return;
    const result = await api.threads.reply({
      parent: nodeId,
      content,
    });
    if ("error" in result) {
      const message = publicErrorMessage(result.error);
      toast.error(message);
      throw new Error(message);
    } else {
      toast.success("Reply posted");
      setReplying(false);
      onChanged();
    }
  }

  async function remove() {
    if (!session) return;
    const result = await api.posts.delete({ post: postId });
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "This post has replies and cannot be deleted."
          : publicErrorMessage(result.error),
      );
    } else {
      toast.success(isRoot ? "Thread deleted" : "Post deleted");
      if (isRoot) router.replace("/");
      else onChanged();
    }
  }

  async function toggleAccepted() {
    if (!session) return;
    const result = isAccepted
      ? await api.resolutions.clear({ question: questionId })
      : await api.resolutions.accept({
          question: questionId,
          answer: postId,
        });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(isAccepted ? "Answer unmarked" : "Marked as the answer");
      onChanged();
    }
  }

  async function moderatorTrash() {
    if (!session) return;
    if (isRoot) {
      const result = await api.trash.trash({ item: scope });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        toast.success("Thread moved to trash");
        router.replace("/");
      }
      return;
    }
    // Deeper replies first, so a failure part-way never hides a reply's context before the reply.
    const targets = withReplies
      ? [...descendants].reverse().concat(postId)
      : [postId];
    let failed = 0;
    for (const item of targets) {
      const result = await api.trash.trash({ item });
      if ("error" in result) failed += 1;
    }
    if (failed > 0)
      toast.error(
        `${count(failed, "post")} of ${targets.length} could not be moved to trash.`,
      );
    else
      toast.success(
        targets.length > 1
          ? `Reply and ${count(descendants.length, "reply", "replies")} moved to trash`
          : "Reply moved to trash",
      );
    setWithReplies(false);
    onChanged();
  }

  return (
    <article
      id={`post-${postId}`}
      className={cn(
        "scroll-mt-24 rounded-xl border bg-card p-4 shadow-sm transition-colors sm:p-5",
        isAccepted
          ? "border-emerald-500/50 ring-1 ring-emerald-500/20"
          : highlightUnread
            ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/10"
            : "border-border",
      )}
    >
      <header className="mb-3 flex items-center gap-3">
        <UserAvatar user={author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <UserName user={author} />
              <UserRole user={author} />
            </span>
            <Fact.When at={node.post.createdAt} />
            {highlightUnread ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                New
              </span>
            ) : null}
            {edited ? <RevisionsDialog item={postId} /> : null}
          </div>
        </div>
        {isAccepted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Answer
          </span>
        ) : null}
      </header>

      {editing ? (
        <Composer
          session={session ?? undefined}
          initialValue={node.post.content}
          submitLabel="Save edit"
          autoFocus
          onSubmit={saveEdit}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <RenderedMarkdown
          html={node.rendered}
          // The page prints the opening post's first line as its heading, so
          // the body drops it. Any level, not only h1: an author who edits the
          // post is free to change the hashes, and did.
          className={
            isRoot ? "[&>:is(h1,h2,h3,h4,h5,h6):first-child]:hidden" : undefined
          }
        />
      )}

      {!editing && controlsReady ? (
        <PostLinks post={postId} controls={sharedControls} />
      ) : null}

      {!editing ? (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {controlsReady ? (
            <ReactionBar target={postId} controls={sharedControls} />
          ) : (
            <div className="text-sm text-muted-foreground" role="status">
              {controls?.error ?? "Loading post controls…"}
              {controls?.error ? (
                <Button variant="ghost" size="sm" onClick={controls.refetch}>
                  Retry
                </Button>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-0.5">
            {canAcceptAnswers ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAccepted}
                className={cn(
                  "gap-1.5",
                  isAccepted
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {isAccepted ? (
                  <XCircle className="size-4" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {isAccepted ? "Unmark" : "Accept"}
              </Button>
            ) : null}
            {controlsReady ? (
              <BookmarkButton item={postId} controls={sharedControls} />
            ) : null}
            {controlsReady ? (
              <PinControl
                item={postId}
                scope={scope}
                onChanged={onChanged}
                controls={sharedControls}
              />
            ) : null}
            {session && !locked ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplying((v) => !v)}
                className="gap-1.5 text-muted-foreground"
              >
                <CornerUpLeft className="size-4" />
                Reply
              </Button>
            ) : null}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground"
                    aria-label="Post actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isMine ? (
                    <>
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={remove}>
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => setFlagOpen(true)}>
                    <FlagIcon className="size-4" />
                    Report
                  </DropdownMenuItem>
                  {canModerate ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setTrashOpen(true)}>
                        <Trash2 className="size-4" />
                        {isRoot ? "Move thread to trash" : "Move to trash"}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </footer>
      ) : null}

      {replying ? (
        <div className="mt-4">
          <Composer
            session={session ?? undefined}
            placeholder="Write a reply…"
            submitLabel="Post reply"
            minRows={4}
            autoFocus
            onSubmit={submitReply}
            onCancel={() => setReplying(false)}
          />
        </div>
      ) : null}

      <ConfirmAction
        open={trashOpen}
        onOpenChange={(open) => {
          setTrashOpen(open);
          if (!open) setWithReplies(false);
        }}
        title={
          isRoot ? "Move this thread to trash?" : "Move this reply to trash?"
        }
        description={
          isRoot ? (
            <p>
              The whole discussion, including every reply, is hidden until a
              moderator restores it from the trash.
            </p>
          ) : (
            <div className="space-y-3">
              <p>
                Its text is hidden and its place in the discussion shows as
                removed. Replies to it stay visible.
              </p>
              {descendants.length > 0 ? (
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={withReplies}
                    onChange={(event) => setWithReplies(event.target.checked)}
                  />
                  <span>
                    Also move {count(descendants.length, "reply", "replies")}{" "}
                    beneath it to trash. Each can be restored on its own.
                  </span>
                </label>
              ) : null}
            </div>
          )
        }
        confirmLabel={
          isRoot
            ? "Move thread to trash"
            : withReplies && descendants.length > 0
              ? `Move ${count(descendants.length + 1, "post")} to trash`
              : "Move to trash"
        }
        destructive
        onConfirm={moderatorTrash}
      />
      <FlagDialog target={postId} open={flagOpen} onOpenChange={setFlagOpen} />
    </article>
  );
}
