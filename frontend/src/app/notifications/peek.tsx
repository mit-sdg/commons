"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useMemo } from "react";
import { Link } from "@/components/link";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  groupNotifications,
  type MergedNotification,
} from "@/lib/task-notifications";
import { NotificationList } from "./notification-row";
import { useInbox } from "./use-inbox";

/** How much of the inbox the bell shows before sending the reader to the page. */
const PEEK_GROUPS = 6;

/**
 * The bell's triage surface: the most recent handful of merged rows, each
 * markable and dismissable where it stands, with the archive one click away.
 * The page keeps the history; this only clears the top of it.
 */
export function NotificationPeek({ onLeave }: { onLeave: () => void }) {
  const inbox = useInbox();

  const groups = useMemo(
    () => groupNotifications(inbox.entries).slice(0, PEEK_GROUPS),
    [inbox.entries],
  );
  const unread = inbox.unread.forum + inbox.unread.task;

  function activate(entry: MergedNotification) {
    inbox.activate(entry);
    if (inbox.hrefOf(entry)) onLeave();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">
          Notifications
          {unread > 0 ? (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {unread} unread
            </span>
          ) : null}
        </p>
        {unread > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={() => void inbox.markAll()}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        ) : null}
      </div>

      {inbox.loading ? (
        <LoadingState />
      ) : inbox.error ? (
        <div className="p-3">
          <ErrorState message={inbox.error} onRetry={inbox.refetch} />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Bell className="size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing new</p>
        </div>
      ) : (
        <ScrollArea className="max-h-96 w-full [&_[data-slot=scroll-area-viewport]>div]:!block">
          <NotificationList
            className="p-1.5"
            groups={groups}
            hrefOf={inbox.hrefOf}
            onActivate={activate}
            onMarkRead={(entries) => void inbox.markRead(entries)}
            onDismiss={(entry) => void inbox.dismiss(entry)}
          />
        </ScrollArea>
      )}

      <div className="border-t border-border p-1.5">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={onLeave}
        >
          <Link href="/notifications">See all notifications</Link>
        </Button>
      </div>
    </div>
  );
}
