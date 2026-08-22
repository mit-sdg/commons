"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  applyUnreadCounts,
  readUnreadCounts,
  type UnreadCounts,
  unreadBadge,
} from "@/lib/task-notifications";

interface NotificationCountState {
  /** The badge: the forum instance's unread count plus the task instance's. */
  count: number;
  setForumCount: (count: number) => void;
  setTaskCount: (count: number) => void;
}

const NotificationCountContext = createContext<NotificationCountState | null>(
  null,
);

const NO_UNREAD: UnreadCounts = { forum: 0, task: 0 };

export function NotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>(NO_UNREAD);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const poll = async () => {
      const update = await readUnreadCounts(
        () => api.notifications.unreadCount({}),
        () => api.tasknotifications.unreadCount({}),
      );
      // Each half stands on its own: one instance failing leaves the other's
      // figure applied and the badge stale until the next poll or a retry.
      if (active) setCounts((previous) => applyUnreadCounts(previous, update));
    };
    void poll();
    const id = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session]);

  const setForumCount = useCallback((forum: number) => {
    setCounts((previous) => ({ ...previous, forum }));
  }, []);

  const setTaskCount = useCallback((task: number) => {
    setCounts((previous) => ({ ...previous, task }));
  }, []);

  const value = useMemo(
    () => ({ count: unreadBadge(counts), setForumCount, setTaskCount }),
    [counts, setForumCount, setTaskCount],
  );

  return (
    <NotificationCountContext.Provider value={value}>
      {children}
    </NotificationCountContext.Provider>
  );
}

export function useNotificationCount(): NotificationCountState {
  const state = useContext(NotificationCountContext);
  if (!state) {
    throw new Error(
      "useNotificationCount must be used within <NotificationCountProvider>",
    );
  }
  return state;
}
