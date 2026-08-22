"use client";

import { Bell } from "lucide-react";
import { useState } from "react";
import { NotificationPeek } from "@/app/notifications/peek";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationCount } from "@/lib/notification-count";

export function NotificationBell() {
  const { count } = useNotificationCount();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
        >
          <Bell className="size-[1.15rem]" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold leading-4 text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(30rem,calc(100vw-2rem))] p-0"
      >
        {/* Mounted only while open, so the bell reads both inboxes on demand
            rather than polling a second time behind the badge. */}
        <NotificationPeek onLeave={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
