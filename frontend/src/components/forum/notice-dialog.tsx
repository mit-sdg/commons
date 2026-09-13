"use client";

import { Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { count } from "@/lib/format";

/**
 * Sending is one-way and reaches other people's inboxes, so the number of
 * recipients is shown before the send rather than reported after it. The count
 * is read when the dialog opens; the send answers with the count it used, which
 * is the one worth reporting.
 */
export function NoticeDialog({
  post,
  open,
  onOpenChange,
  onNotified,
}: {
  post: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNotified?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const preview = useQuery<{ recipients: number; notified: boolean }>(
    open ? () => api.notices.preview({ post }) : null,
    [post, open],
  );

  async function send() {
    setBusy(true);
    const result = await api.notices.notify({ post });
    setBusy(false);
    if ("error" in result) {
      toast.error(
        result.error === "CONFLICT"
          ? "This post has already notified its audience."
          : publicErrorMessage(result.error),
      );
    } else {
      toast.success(
        `Audience notified — ${count(result.recipients, "person", "people")}.`,
      );
    }
    onNotified?.();
    onOpenChange(false);
  }

  const alreadySent = preview.data?.notified === true;
  const recipients = preview.data?.recipients ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Megaphone className="size-4" />
            Notify the audience
          </DialogTitle>
          <DialogDescription>
            {preview.error
              ? preview.error
              : preview.data === null
                ? "Counting who would receive this…"
                : alreadySent
                  ? "This post has already notified its audience. Publish a correction as a new post."
                  : recipients === 0
                    ? "Nobody else can read this post right now, so there is no one to notify."
                    : `${count(recipients, "person", "people")} who can already read this discussion will get an in-app notification and an email containing this post. The author is not notified. A post can notify its audience only once.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={
              busy || preview.data === null || alreadySent || recipients === 0
            }
          >
            {busy ? <Spinner className="size-4" /> : null}
            {preview.data === null
              ? "Notify audience"
              : `Notify ${count(recipients, "person", "people")}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
