"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  filterNotifications,
  groupNotifications,
  NOTIFICATION_FILTERS,
  type NotificationFilter,
} from "@/lib/task-notifications";
import { NotificationList } from "./notification-row";
import { useInbox } from "./use-inbox";

const FILTER_LABELS: Record<NotificationFilter, string> = {
  all: "All",
  unread: "Unread",
  forum: "Discussions",
  task: "Tasks",
};

const EMPTY_DESCRIPTIONS: Record<NotificationFilter, string> = {
  all: "When something happens, you'll hear about it here.",
  unread: "Everything here has been read.",
  forum: "Replies, mentions, and answers will show up here.",
  task: "Task assignments and list changes will show up here.",
};

function Notifications() {
  const inbox = useInbox();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const unread = inbox.unread.forum + inbox.unread.task;

  const slices = useMemo(() => {
    const built = {} as Record<
      NotificationFilter,
      ReturnType<typeof groupNotifications>
    >;
    for (const each of NOTIFICATION_FILTERS) {
      built[each] = groupNotifications(
        filterNotifications(inbox.entries, each),
      );
    }
    return built;
  }, [inbox.entries]);

  return (
    <PageContainer width="narrow" className="max-w-3xl">
      <PageHeader
        eyebrow="Activity"
        title="Notifications"
        description="Replies, mentions, updates on topics you follow, and changes to your tasks."
        actions={
          unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void inbox.markAll()}
              className="gap-2"
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {inbox.loading ? (
        <LoadingState />
      ) : inbox.error ? (
        <ErrorState message={inbox.error} onRetry={inbox.refetch} />
      ) : (
        <Tabs
          value={filter}
          onValueChange={(next) => setFilter(next as NotificationFilter)}
        >
          <TabsList variant="line">
            {NOTIFICATION_FILTERS.map((each) => (
              <TabsTrigger key={each} value={each}>
                {FILTER_LABELS[each]}
                {each === "unread" && unread > 0 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 text-[0.7rem] font-semibold text-primary">
                    {unread}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          {NOTIFICATION_FILTERS.map((each) => (
            <TabsContent key={each} value={each} className="mt-3">
              {slices[each].length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="Nothing here"
                  description={EMPTY_DESCRIPTIONS[each]}
                />
              ) : (
                <NotificationList
                  groups={slices[each]}
                  hrefOf={inbox.hrefOf}
                  onActivate={inbox.activate}
                  onMarkRead={(entries) => void inbox.markRead(entries)}
                  onDismiss={(entry) => void inbox.dismiss(entry)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </PageContainer>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}
