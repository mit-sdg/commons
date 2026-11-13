"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Pins are shared by everyone and changed only by Staff; stars belong to the
 * signed-in account. Both are kept on the server, and the server answers only
 * the discussions this reader may currently read.
 */
export interface DiscussionMarks {
  /** Pinned discussions, most recently pinned first. */
  pinned: string[];
  starred: ReadonlySet<string>;
  /** Whether this account may pin and unpin discussions. */
  canPin: boolean;
  isPinned: (conversation: string) => boolean;
  isStarred: (conversation: string) => boolean;
  togglePin: (conversation: string) => Promise<void>;
  toggleStar: (conversation: string) => Promise<void>;
}

const NONE: ReadonlySet<string> = new Set();

const DiscussionMarksContext = createContext<DiscussionMarks>({
  pinned: [],
  starred: NONE,
  canPin: false,
  isPinned: () => false,
  isStarred: () => false,
  togglePin: async () => {},
  toggleStar: async () => {},
});

export function DiscussionMarksProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me, permissions } = useAuth();
  const user = me?.user ?? null;
  // The server's Staff rule: any staff capability, or administer.
  const canPin = permissions.isStaff || permissions.can("administer");
  const pins = useQuery(
    user
      ? async () =>
          unwrap(await api.discussions.pinned({})).pinned.map((row) =>
            String(row.conversation),
          )
      : null,
    [user],
    { retainOnTransportError: true },
  );
  const stars = useQuery(
    user
      ? async () =>
          new Set(
            unwrap(await api.discussions.starred({})).starred.map((row) =>
              String(row.conversation),
            ),
          )
      : null,
    [user],
    { retainOnTransportError: true },
  );
  const refetchPins = pins.refetch;
  const refetchStars = stars.refetch;
  const pinned = useMemo(() => pins.data ?? [], [pins.data]);
  const starred = stars.data ?? NONE;

  // A second click on the same control waits for the first to be answered.
  const saving = useRef(new Set<string>());

  const togglePin = useCallback(
    async (conversation: string) => {
      const key = `pin ${conversation}`;
      if (saving.current.has(key)) return;
      saving.current.add(key);
      try {
        const was = pinned.includes(conversation);
        const result = was
          ? await api.discussions.unpin({ conversation })
          : await api.discussions.pin({ conversation });
        if ("error" in result) toast.error(publicErrorMessage(result.error));
        else
          toast.success(was ? "Unpinned for everyone" : "Pinned for everyone");
        refetchPins();
      } finally {
        saving.current.delete(key);
      }
    },
    [pinned, refetchPins],
  );

  const toggleStar = useCallback(
    async (conversation: string) => {
      const key = `star ${conversation}`;
      if (saving.current.has(key)) return;
      saving.current.add(key);
      try {
        const was = starred.has(conversation);
        const result = was
          ? await api.discussions.unstar({ conversation })
          : await api.discussions.star({ conversation });
        if ("error" in result) toast.error(publicErrorMessage(result.error));
        refetchStars();
      } finally {
        saving.current.delete(key);
      }
    },
    [starred, refetchStars],
  );

  const value = useMemo<DiscussionMarks>(
    () => ({
      pinned,
      starred,
      canPin,
      isPinned: (conversation) => pinned.includes(conversation),
      isStarred: (conversation) => starred.has(conversation),
      togglePin,
      toggleStar,
    }),
    [pinned, starred, canPin, togglePin, toggleStar],
  );

  return (
    <DiscussionMarksContext.Provider value={value}>
      {children}
    </DiscussionMarksContext.Provider>
  );
}

export function useDiscussionMarks(): DiscussionMarks {
  return useContext(DiscussionMarksContext);
}

/** Pinned discussions first, in pin order, then the rest in their own order. */
export function pinnedFirst(
  conversations: readonly string[],
  pinned: readonly string[],
): string[] {
  const present = new Set(conversations);
  const top = pinned.filter((conversation) => present.has(conversation));
  const raised = new Set(top);
  return [
    ...top,
    ...conversations.filter((conversation) => !raised.has(conversation)),
  ];
}
