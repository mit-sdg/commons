"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function useUnread(conversation: string, rootItem: string) {
  const { session } = useAuth();
  const list = useQuery<{ items: { item: string }[] }>(
    session ? () => api.unread.list({ scope: conversation }) : null,
    [session, conversation],
  );
  const count = useQuery<{ count: number }>(
    session ? () => api.unread.count({ scope: conversation }) : null,
    [session, conversation],
  );

  const refetchList = list.refetch;
  const refetchCount = count.refetch;

  useEffect(() => {
    if (!session || !rootItem) return;
    void api.unread.markAllSeen({ scope: conversation }).then(() => {
      refetchList();
      refetchCount();
    });
  }, [session, rootItem, conversation, refetchList, refetchCount]);

  const unreadItems = useMemo(() => {
    const items = list.data?.items ?? [];
    return new Set(
      items.map((i) => String(i.item)).filter((id) => id !== rootItem),
    );
  }, [list.data, rootItem]);

  const newCount = count.data?.count ?? unreadItems.size;

  async function markAll() {
    if (!session) return;
    await api.unread.markAllSeen({ scope: conversation });
    list.refetch();
    count.refetch();
  }

  return { unreadItems, newCount, markAll, enabled: !!session };
}
