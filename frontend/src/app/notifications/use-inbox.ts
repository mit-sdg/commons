"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { notifyHashTargetNavigation } from "@/hooks/use-hash-target-highlight";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNotificationCount } from "@/lib/notification-count";
import {
  loadMergedInbox,
  type MergedForumNotification,
  type MergedNotification,
  markAllReadBoth,
  taskRowHref,
  unreadBySource,
} from "@/lib/task-notifications";

export interface Inbox {
  entries: MergedNotification[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  unread: { forum: number; task: number };
  /** Where a row goes, or null when it names nowhere to go. */
  hrefOf: (entry: MergedNotification) => string | null;
  /** Open a row: read it, then follow it if it leads anywhere. */
  activate: (entry: MergedNotification) => void;
  /** Mark one row or a whole collapsed group read. */
  markRead: (entries: MergedNotification[]) => Promise<void>;
  dismiss: (entry: MergedNotification) => Promise<void>;
  markAll: () => Promise<void>;
}

/**
 * Both inboxes, and the actions over them, shared by the page and the bell.
 *
 * Every action goes to the instance that owns the row it acts on, and the two
 * mark-all-read calls stay two calls: the half that applied stays applied and a
 * partial failure is said out loud rather than smoothed over.
 */
export function useInbox(): Inbox {
  const { session } = useAuth();
  const { setForumCount, setTaskCount } = useNotificationCount();
  const router = useRouter();

  const { data, error, loading, refetch } = useQuery<{
    notifications: MergedNotification[];
  }>(
    session
      ? () =>
          loadMergedInbox(
            () => api.notifications.inbox({}),
            () => api.tasknotifications.inbox({}),
          )
      : null,
    [session],
  );

  const entries = useMemo(
    () => data?.notifications ?? [],
    [data?.notifications],
  );
  const unread = useMemo(() => unreadBySource(entries), [entries]);

  useEffect(() => {
    if (!data) return;
    setForumCount(unread.forum);
    setTaskCount(unread.task);
  }, [data, setForumCount, setTaskCount, unread]);

  const [links, setLinks] = useState<Record<string, string | null>>({});

  useEffect(() => {
    // Only a forum row's link is a post. A task row's link is a task, and the
    // list it belongs to travels with the row, so it needs no resolution.
    const postRows = entries.filter(
      (entry): entry is MergedForumNotification =>
        entry.source === "forum" && Boolean(entry.row.link),
    );
    const resolveLinks = async () => {
      const resolved: Record<string, string | null> = {};
      await Promise.all(
        postRows.map(async (entry) => {
          const postId = String(entry.row.link);
          try {
            const answer = await api.threads.forItem({ item: postId });
            if (!isApiError(answer) && answer.conversation) {
              resolved[entry.id] = `/t/${answer.conversation}#post-${postId}`;
            }
          } catch {
            resolved[entry.id] = null;
          }
        }),
      );
      setLinks(resolved);
    };
    if (postRows.length > 0) resolveLinks();
  }, [entries]);

  const hrefOf = useCallback(
    (entry: MergedNotification): string | null =>
      entry.source === "forum"
        ? (links[entry.id] ?? null)
        : taskRowHref(entry.row),
    [links],
  );

  const markRead = useCallback(
    async (targets: MergedNotification[]) => {
      if (!session) return;
      const unreadTargets = targets.filter((entry) => !entry.read);
      if (unreadTargets.length === 0) return;
      const results = await Promise.all(
        unreadTargets.map((entry) =>
          entry.source === "forum"
            ? api.notifications.markRead({ notification: entry.id })
            : api.tasknotifications.markRead({ notification: entry.id }),
        ),
      );
      for (const result of results) {
        if (!isApiError(result)) continue;
        toast.error(publicErrorMessage(result.error));
        break;
      }
      refetch();
    },
    [session, refetch],
  );

  const dismiss = useCallback(
    async (entry: MergedNotification) => {
      if (!session) return;
      const notification = entry.id;
      const result =
        entry.source === "forum"
          ? await api.notifications.dismiss({ notification })
          : await api.tasknotifications.dismiss({ notification });
      if (isApiError(result)) toast.error(publicErrorMessage(result.error));
      refetch();
    },
    [session, refetch],
  );

  const markAll = useCallback(async () => {
    if (!session) return;
    const { forumError, taskError } = await markAllReadBoth(
      () => api.notifications.markAllRead({}),
      () => api.tasknotifications.markAllRead({}),
    );
    // Two instances, two calls, no shared transaction: the half that applied
    // stays applied, and the badge keeps whatever the other half still holds.
    if (!forumError) setForumCount(0);
    if (!taskError) setTaskCount(0);
    if (forumError && taskError) {
      toast.error(publicErrorMessage(forumError));
    } else if (forumError ?? taskError) {
      const failure = (forumError ?? taskError) as string;
      toast.error(
        `Some notifications could not be marked read. ${publicErrorMessage(failure)}`,
      );
    } else {
      toast.success("All caught up");
    }
    refetch();
  }, [session, refetch, setForumCount, setTaskCount]);

  const activate = useCallback(
    (entry: MergedNotification) => {
      if (!entry.read) void markRead([entry]);
      const href = hrefOf(entry);
      if (!href) return;
      router.push(href);
      if (entry.source === "forum") {
        notifyHashTargetNavigation(`post-${String(entry.row.link)}`);
      }
    },
    [hrefOf, markRead, router],
  );

  return {
    entries,
    loading: loading && !data,
    error,
    refetch,
    unread,
    hrefOf,
    activate,
    markRead,
    dismiss,
    markAll,
  };
}
