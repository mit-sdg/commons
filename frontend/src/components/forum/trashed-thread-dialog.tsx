"use client";

import { useState } from "react";
import { Fact } from "@/components/facts";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserName } from "@/components/user-name";
import { useQuery } from "@/hooks/use-query";
import { api, type Output } from "@/lib/api";
import { titleFromContent } from "@/lib/format";
import { buildThreadTree, type ThreadBranch } from "@/lib/thread-tree";

type StoredNode = Output<"/moderation/threads/get">["thread"][number];

function StoredBranch({ branch }: { branch: ThreadBranch<StoredNode> }) {
  const node = branch.node;
  const post = node?.post;
  return (
    <li>
      <article
        id={`review-post-${branch.position.item}`}
        className="rounded-lg border border-border p-4"
      >
        {post?.content != null ? (
          <>
            <header className="mb-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {post.author ? <UserName user={post.author} /> : null}
              <Fact.When at={post.createdAt} />
              {node?.trashed ? <span>Reply also in trash</span> : null}
            </header>
            <RenderedMarkdown html={post.rendered ?? ""} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This post’s text was permanently deleted.
          </p>
        )}
      </article>
      {branch.children.length > 0 ? (
        <ol className="mt-3 space-y-3 border-l border-border pl-3">
          {branch.children.map((child) => (
            <StoredBranch key={child.position.node} branch={child} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function TrashedThreadDialog({
  conversation,
}: {
  conversation: string;
}) {
  const [open, setOpen] = useState(false);
  const { data, error, loading, refetch } = useQuery<
    Output<"/moderation/threads/get">
  >(open ? () => api.moderation["threads/get"]({ conversation }) : null, [
    conversation,
    open,
  ]);
  const opening = data?.thread.find((node) => node.parent === null)?.post;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Review thread
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {opening?.content != null
              ? titleFromContent(opening.content)
              : "Trashed thread"}
          </DialogTitle>
          <DialogDescription>
            The discussion remains hidden from its audience.
          </DialogDescription>
        </DialogHeader>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : data ? (
          <ol aria-label="Trashed discussion" className="space-y-3">
            {buildThreadTree(data.thread, data.thread).map((branch) => (
              <StoredBranch key={branch.position.node} branch={branch} />
            ))}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
