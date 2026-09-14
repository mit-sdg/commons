"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { api, publicErrorMessage } from "@/lib/api";
import { count } from "@/lib/format";
import { loadThreadPage } from "@/lib/loaders";
import { buildThreadTree, visibleDescendants } from "@/lib/thread-tree";

export interface TrashTarget {
  item: string;
  conversation: string;
  isRoot: boolean;
  descendants: string[];
}

/** The queue loads the current outline only when the moderator chooses to act. */
export function FlagTrashButton({
  item,
  conversation,
  onChanged,
}: {
  item: string;
  conversation: string | null;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<TrashTarget | null>(null);
  const [loading, setLoading] = useState(false);
  async function open() {
    if (!conversation) return;
    setLoading(true);
    try {
      const page = await loadThreadPage(conversation);
      const pending = buildThreadTree(page.nodes, page.structure);
      while (pending.length > 0) {
        const branch = pending.pop()!;
        if (branch.node?.item === item) {
          const isRoot = branch.position.node === page.rootNodeId;
          setTarget({
            item,
            conversation,
            isRoot,
            descendants: isRoot ? [] : visibleDescendants(branch),
          });
          return;
        }
        pending.push(...branch.children);
      }
      toast.error("That item is not available.");
      onChanged();
    } catch {
      toast.error("Could not load the discussion. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-destructive"
        disabled={loading || !conversation}
        onClick={open}
      >
        <Trash2 className="size-4" />
        {loading ? "Loading…" : "Move to trash"}
      </Button>
      {target ? (
        <TrashPostDialog
          target={target}
          onClose={() => setTarget(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  );
}

/** Both the flag queue and a post's menu use the same snapshot and confirmation. */
export function TrashPostDialog({
  target,
  onClose,
  onChanged,
}: {
  target: TrashTarget;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [withReplies, setWithReplies] = useState(false);
  const { item, conversation, isRoot, descendants } = target;

  async function trash() {
    if (isRoot) {
      const result = await api.trash.trash({ item: conversation });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        toast.success("Thread moved to trash");
        onChanged();
      }
      return;
    }
    // This is a batch of individual requests, never a hidden subtree marker.
    const targets = withReplies
      ? [...descendants].reverse().concat(item)
      : [item];
    let failed = 0;
    for (const selected of targets) {
      const result = await api.trash.trash({ item: selected });
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
    onChanged();
  }

  return (
    <ConfirmAction
      open
      onOpenChange={(open) => {
        if (!open) onClose();
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
      onConfirm={trash}
    />
  );
}
