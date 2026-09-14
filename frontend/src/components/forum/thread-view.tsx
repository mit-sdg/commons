"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Lock,
  LockOpen,
  MessageSquare,
  Pin,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AudienceChips } from "@/components/forum/audience-picker";
import { CategoryBadge } from "@/components/forum/badges";
import { CategoryAssign } from "@/components/forum/category-assign";
import { Composer } from "@/components/forum/composer";
import { NoticeDialog } from "@/components/forum/notice-dialog";
import { PostCard } from "@/components/forum/post-card";
import { PostControlsProvider } from "@/components/forum/post-controls-provider";
import { PostPreview } from "@/components/forum/post-preview";
import { SubscribeButton } from "@/components/forum/subscribe-button";
import { TagEditor } from "@/components/forum/tag-editor";
import { UnreadBanner } from "@/components/forum/unread-banner";
import { Link } from "@/components/link";
import { BackLink, PageContainer } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useHashTargetHighlight } from "@/hooks/use-hash-target-highlight";
import { useQuery } from "@/hooks/use-query";
import { useUnread } from "@/hooks/use-unread";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { replyScope } from "@/lib/drafts";
import { count, titleFromContent } from "@/lib/format";
import { loadThreadPage, type ThreadPage } from "@/lib/loaders";
import type { ThreadNode } from "@/lib/models";
import { loadMyLists } from "@/lib/tasks";
import {
  ancestorNodes,
  type BranchSummary,
  buildThreadTree,
  postAnchorItem,
  summarizeBranches,
  type ThreadBranch,
  visibleDescendants,
} from "@/lib/thread-tree";
import { cn } from "@/lib/utils";

/** A removed reply keeps its place so the replies beneath it stay in context. */
function RemovedPost({
  item,
  isRoot,
  onChanged,
}: {
  item: string;
  isRoot: boolean;
  onChanged: () => void;
}) {
  const { session, permissions } = useAuth();
  const canModerate = !!session && permissions.can("moderate");
  const trashed = useQuery<{ trashed: boolean }>(
    canModerate ? () => api.trash.isTrashed({ item }) : null,
    [item, canModerate],
  );
  async function restore() {
    const result = await api.trash.restore({ item });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Reply restored");
      onChanged();
    }
  }
  return (
    <div
      id={`post-${item}`}
      data-removed-post={item}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
    >
      <span>
        {isRoot
          ? "Opening post unavailable"
          : "This reply was removed by a moderator."}
      </span>
      {canModerate && trashed.data?.trashed ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={restore}>
            Restore
          </Button>
          <Link href="/moderation" className="text-xs hover:underline">
            Trash bin
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function ThreadView({
  conversation,
  batchedControls = false,
  fromGroup,
}: {
  conversation: string;
  batchedControls?: boolean;
  fromGroup?: string;
}) {
  const { session, permissions } = useAuth();
  const { data, error, refused, loading, refetch } = useQuery<ThreadPage>(
    () => loadThreadPage(conversation),
    [conversation],
  );
  const groups = useQuery(session ? loadMyLists : null, [session]);
  const origin = groups.data?.find((group) => group.list === fromGroup);
  const subscribers = useQuery<{ subscribers: { user: string }[] }>(
    () => api.subscriptions.subscribers({ target: conversation }),
    [conversation],
  );
  const pinned = useQuery<{ pinned: { item: string; priority: number }[] }>(
    () => api.pins.forScope({ scope: conversation }),
    [conversation],
  );
  // Which posts have already notified their audience. Staff alone may ask, so
  // every other reader runs no query and every card renders no control.
  const notices = useQuery<{ notices: { post: string }[] }>(
    session && permissions.isStaff
      ? () => api.notices.forConversation({ conversation })
      : null,
    [conversation, session, permissions.isStaff],
  );
  const hashTargetVersion =
    data?.nodes.map((node) => String(node.item)).join("\u0000") ?? "";
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  // A reply posted with "Post and notify" confirms on the post it just made,
  // so the count staff approve is the real one rather than a guess.
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  const unread = useUnread(conversation, data ? data.questionId : "");

  useHashTargetHighlight({
    enabled: !!data,
    deps: [conversation, hashTargetVersion],
    // A notification or pinned-post jump may land on a reply that someone
    // collapsed out of sight, so open the branches above it first.
    onTarget: (targetId) => {
      const item = postAnchorItem(targetId);
      if (!data || !item) return;
      const ancestors = ancestorNodes(data.structure, item);
      setCollapsedNodes((current) => {
        if (!ancestors.some((node) => current.has(node))) return current;
        const next = new Set(current);
        for (const node of ancestors) next.delete(node);
        return next;
      });
    },
  });

  if (loading && !data) return <LoadingState label="Loading discussion…" />;
  if (error)
    return <ErrorState message={error} refused={refused} onRetry={refetch} />;
  if (!data) return null;

  const {
    nodes,
    root,
    questionId,
    category,
    tags,
    locked,
    acceptedAnswer,
    replyCount,
  } = data;
  const rootAuthorId = root ? String(root.post.author) : "";
  const title = root
    ? titleFromContent(root.post.content)
    : "Opening post unavailable";
  const subscriberCount = subscribers.data?.subscribers.length ?? 0;
  const notifiedPosts = new Set(
    (notices.data?.notices ?? []).map((notice) => String(notice.post)),
  );
  const pinnedItems = pinned.data?.pinned ?? [];
  const threadTree = buildThreadTree(nodes, data.structure);
  const summaries = summarizeBranches(threadTree, unread.unreadItems);
  const collapsible = [...summaries]
    .filter(([, summary]) => summary.replies > 0)
    .map(([node]) => node);
  const allCollapsed =
    collapsible.length > 0 &&
    collapsible.every((node) => collapsedNodes.has(node));

  function setBranchCollapsed(node: string, collapsed: boolean) {
    setCollapsedNodes((current) => {
      if (current.has(node) === collapsed) return current;
      const next = new Set(current);
      if (collapsed) next.add(node);
      else next.delete(node);
      return next;
    });
  }

  function refetchAll() {
    refetch();
    pinned.refetch();
    subscribers.refetch();
    notices.refetch();
  }

  async function toggleLock() {
    if (!session) return;
    const result = locked
      ? await api.locks.unlock({ target: conversation })
      : await api.locks.lock({ target: conversation });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(locked ? "Topic unlocked" : "Topic locked");
      refetch();
    }
  }

  async function postRootReply(content: string, notify = false) {
    if (!session || !root) return;
    const result = await api.threads.reply({
      parent: String(root.node),
      content,
    });
    if ("error" in result) {
      const message = publicErrorMessage(result.error);
      toast.error(message);
      throw new Error(message);
    } else {
      toast.success("Reply posted");
      refetchAll();
      if (notify) setPendingNotice(String(result.post));
    }
  }

  return (
    <PageContainer>
      <BackLink
        href={
          origin
            ? `/groups/${encodeURIComponent(origin.list)}?view=discussions`
            : "/"
        }
      >
        {origin ? origin.title || "Group discussions" : "All discussions"}
      </BackLink>

      <header className="mb-6 border-b border-border pb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {category ? (
            <CategoryBadge
              id={String(category.category)}
              name={category.name}
            />
          ) : null}
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <Lock className="size-3" />
              Locked
            </span>
          ) : null}
        </div>
        <h1 className="font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MessageSquare className="size-4" />
              {count(replyCount, "reply", "replies")}
            </span>
            {subscriberCount > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" />
                {count(subscriberCount, "follower")}
              </span>
            ) : null}
            {acceptedAnswer ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                Solved
              </span>
            ) : null}
          </div>
          {/* Four labelled buttons are wider than a phone, so they wrap here
              rather than pushing the whole page sideways. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {collapsible.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  setCollapsedNodes(
                    allCollapsed ? new Set() : new Set(collapsible),
                  )
                }
              >
                {allCollapsed ? (
                  <ChevronsUpDown className="size-4" />
                ) : (
                  <ChevronsDownUp className="size-4" />
                )}
                {allCollapsed ? "Expand all" : "Collapse all"}
              </Button>
            ) : null}
            <SubscribeButton
              key={hashTargetVersion}
              conversation={conversation}
            />
            {root ? (
              <CategoryAssign
                item={questionId}
                current={category ? String(category.category) : null}
                onChanged={refetch}
              />
            ) : null}
            {session && permissions.can("moderate") ? (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleLock}
                className="gap-2"
              >
                {locked ? (
                  <LockOpen className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {locked ? "Unlock" : "Lock"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3">
          {root ? (
            <TagEditor target={questionId} tags={tags} onChanged={refetch} />
          ) : null}
        </div>
      </header>

      <AudienceChips
        holders={data.audience.map((holder) => holder.holder)}
        options={data.audience}
        groupLinks={groups.data?.map((group) => group.list)}
      />
      <UnreadBanner newCount={unread.newCount} onMarkAll={unread.markAll} />

      {pinnedItems.length > 0 ? (
        <section className="mb-6">
          <h2 className="eyebrow mb-3 flex items-center gap-1.5">
            <Pin className="size-3.5" />
            Pinned
          </h2>
          <div className="flex flex-col gap-3">
            {pinnedItems.map((p) => (
              <PostPreview
                key={String(p.item)}
                item={String(p.item)}
                conversation={conversation}
              />
            ))}
          </div>
        </section>
      ) : null}

      <PostControlsProvider
        conversation={conversation}
        observation={data}
        enabled={batchedControls}
      >
        <ol className="thread-tree" aria-label="Discussion thread">
          {threadTree.map((branch) => (
            <ThreadBranchView
              key={branch.position.node}
              branch={branch}
              level={0}
              rootNodeId={data.rootNodeId}
              questionId={questionId}
              rootAuthorId={rootAuthorId}
              acceptedAnswer={acceptedAnswer}
              locked={locked}
              scope={conversation}
              unreadItems={unread.unreadItems}
              notifiedPosts={notifiedPosts}
              onNotified={notices.refetch}
              summaries={summaries}
              collapsedNodes={collapsedNodes}
              onCollapsedChange={setBranchCollapsed}
              onChanged={refetchAll}
            />
          ))}
        </ol>
      </PostControlsProvider>

      <section className="mt-8 border-t border-border pt-6">
        {locked ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            This topic is locked. New replies are disabled.
          </p>
        ) : !root ? (
          <p className="text-sm text-muted-foreground">
            Reply to an available post to continue this discussion.
          </p>
        ) : session ? (
          <>
            <h2 className="eyebrow mb-3">Add to the discussion</h2>
            <Composer
              session={session ?? undefined}
              placeholder="Write your reply… Markdown supported."
              submitLabel="Post reply"
              draft={replyScope(conversation)}
              onSubmit={postRootReply}
              altSubmitLabel={
                permissions.isStaff ? "Post and notify" : undefined
              }
              onAltSubmit={
                permissions.isStaff
                  ? (content) => postRootReply(content, true)
                  : undefined
              }
            />
          </>
        ) : (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </section>

      {pendingNotice ? (
        <NoticeDialog
          post={pendingNotice}
          open
          onOpenChange={(next) => {
            if (!next) setPendingNotice(null);
          }}
          onNotified={notices.refetch}
        />
      ) : null}
    </PageContainer>
  );
}

function ThreadBranchView({
  branch,
  level,
  rootNodeId,
  questionId,
  rootAuthorId,
  acceptedAnswer,
  locked,
  scope,
  unreadItems,
  notifiedPosts,
  onNotified,
  summaries,
  collapsedNodes,
  onCollapsedChange,
  onChanged,
}: {
  branch: ThreadBranch<ThreadNode>;
  level: number;
  rootNodeId: string;
  questionId: string;
  rootAuthorId: string;
  acceptedAnswer: string | null;
  locked: boolean;
  scope: string;
  unreadItems: Set<string>;
  notifiedPosts: ReadonlySet<string>;
  onNotified: () => void;
  summaries: Map<string, BranchSummary>;
  collapsedNodes: ReadonlySet<string>;
  onCollapsedChange: (node: string, collapsed: boolean) => void;
  onChanged: () => void;
}) {
  const nodeId = String(branch.position.node);
  const isRoot = branch.position.node === rootNodeId;
  const children = branch.children;
  const hasChildren = children.length > 0;
  const summary = summaries.get(nodeId) ?? { replies: 0, unread: 0 };
  const collapsed = hasChildren && collapsedNodes.has(nodeId);
  const childrenId = `thread-children-${nodeId}`;

  return (
    <li className={cn("thread-branch", level > 0 && "thread-branch--child")}>
      <div className="thread-branch-content">
        {branch.node ? (
          <PostCard
            node={branch.node}
            isRoot={isRoot}
            questionId={questionId}
            rootAuthorId={rootAuthorId}
            acceptedAnswer={acceptedAnswer}
            locked={locked}
            scope={scope}
            getDescendants={() => visibleDescendants(branch)}
            isUnread={unreadItems.has(String(branch.node.item))}
            notified={notifiedPosts.has(String(branch.node.item))}
            onNotified={onNotified}
            onChanged={onChanged}
            onReplied={() => onCollapsedChange(nodeId, false)}
          />
        ) : (
          <RemovedPost
            item={String(branch.position.item)}
            isRoot={isRoot}
            onChanged={onChanged}
          />
        )}
        {hasChildren ? (
          <div className="mt-2">
            <Button
              variant="ghost"
              size="xs"
              className="gap-1.5 text-muted-foreground"
              aria-expanded={!collapsed}
              aria-controls={childrenId}
              onClick={() => onCollapsedChange(nodeId, !collapsed)}
            >
              {collapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {collapsed ? "Show" : "Hide"}{" "}
              {count(summary.replies, "reply", "replies")}
              {collapsed && summary.unread > 0 ? (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary">
                  {summary.unread} new
                </span>
              ) : null}
            </Button>
          </div>
        ) : null}
      </div>

      {hasChildren ? (
        <ol
          id={childrenId}
          hidden={collapsed}
          className={cn(
            "thread-children",
            level >= 5 && "thread-children--compact",
            // The `hidden` attribute alone loses to the list's own display.
            collapsed && "hidden",
          )}
        >
          {children.map((child) => (
            <ThreadBranchView
              key={child.position.node}
              branch={child}
              level={level + 1}
              rootNodeId={rootNodeId}
              questionId={questionId}
              rootAuthorId={rootAuthorId}
              acceptedAnswer={acceptedAnswer}
              locked={locked}
              scope={scope}
              unreadItems={unreadItems}
              notifiedPosts={notifiedPosts}
              onNotified={onNotified}
              summaries={summaries}
              collapsedNodes={collapsedNodes}
              onCollapsedChange={onCollapsedChange}
              onChanged={onChanged}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}
