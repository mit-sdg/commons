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
 *
 * A phone has no room for the whole footer in words, so the label gives way to
 * the megaphone below the small breakpoint. The button keeps its name for
 * screen readers at every width, and the dialog it opens is the same one.
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
      <span
        title="This post has already notified its audience"
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
      >
        <Megaphone className="size-3.5" />
        <span className="sm:hidden">Notified</span>
        <span className="hidden sm:inline">Audience notified</span>
      </span>
    );

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Notify audience"
        className="gap-1.5 text-muted-foreground"
      >
        <Megaphone className="size-4" />
        <span className="hidden sm:inline">Notify audience</span>
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
