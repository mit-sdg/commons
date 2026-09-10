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
import { count, titleFromContent } from "@/lib/format";
import { loadThreadPage, type ThreadPage } from "@/lib/loaders";
import { loadMyLists } from "@/lib/tasks";
import {
  ancestorNodes,
  type BranchSummary,
  buildThreadTree,
  postAnchorItem,
  summarizeBranches,
  type ThreadBranch,
} from "@/lib/thread-tree";
import { cn } from "@/lib/utils";

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
  const hashTargetVersion =
    data?.nodes.map((node) => String(node.item)).join("\u0000") ?? "";
  const [collapsedNodes, setCollapsedNodes] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

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

  async function postRootReply(content: string) {
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
          <div className="flex items-center gap-2">
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
              onSubmit={postRootReply}
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
  summaries,
  collapsedNodes,
  onCollapsedChange,
  onChanged,
}: {
  branch: ThreadBranch;
  level: number;
  rootNodeId: string;
  questionId: string;
  rootAuthorId: string;
  acceptedAnswer: string | null;
  locked: boolean;
  scope: string;
  unreadItems: Set<string>;
  summaries: Map<string, BranchSummary>;
  collapsedNodes: ReadonlySet<string>;
  onCollapsedChange: (node: string, collapsed: boolean) => void;
  onChanged: () => void;
}) {
  const nodeId = String(branch.position.node);
  const isRoot = branch.position.node === rootNodeId;
  const hasChildren = branch.children.length > 0;
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
            isUnread={unreadItems.has(String(branch.node.item))}
            onChanged={onChanged}
            onReplied={() => onCollapsedChange(nodeId, false)}
          />
        ) : (
          <p
            id={`post-${branch.position.item}`}
            className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            {isRoot ? "Opening post unavailable" : "Post unavailable"}
          </p>
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
          {branch.children.map((child) => (
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
