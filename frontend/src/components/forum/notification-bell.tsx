"use client";

import { Bell } from "lucide-react";
import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";
import { useNotificationCount } from "@/lib/notification-count";

export function NotificationBell() {
  const { count } = useNotificationCount();

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
    >
      <Link href="/notifications">
        <Bell className="size-[1.15rem]" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold leading-4 text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
