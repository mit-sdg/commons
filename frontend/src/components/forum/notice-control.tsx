"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { NoticeDialog } from "@/components/forum/notice-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/**
 * Every post staff can read offers this, roots and replies alike, whenever it
 * was written. A post that has already notified says so instead: the send is
 * one-time, and a correction is a new post rather than a second send.
 */
export function NoticeControl({
  post,
  notified,
  onNotified,
}: {
  post: string;
  notified: boolean;
  onNotified?: () => void;
}) {
  const { session, permissions } = useAuth();
  const [open, setOpen] = useState(false);

  if (!session || !permissions.isStaff) return null;

  if (notified)
    return (
      <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium text-muted-foreground">
        <Megaphone className="size-3.5" />
        Audience notified.
      </span>
    );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-muted-foreground"
      >
        <Megaphone className="size-4" />
        Notify audience
      </Button>
      <NoticeDialog
        post={post}
        open={open}
        onOpenChange={setOpen}
        onNotified={onNotified}
      />
    </>
  );
}
