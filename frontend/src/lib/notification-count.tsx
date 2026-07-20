"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface NotificationCountState {
  count: number;
  setCount: (count: number) => void;
}

const NotificationCountContext = createContext<NotificationCountState | null>(
  null,
);

export function NotificationCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const poll = async () => {
      const result = await api.notifications.unreadCount({});
      if (active && !("error" in result)) setCount(result.count);
    };
    void poll();
    const id = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session]);

  const value = useMemo(() => ({ count, setCount }), [count]);

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
