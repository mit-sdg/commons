"use client";

import { CircleAlert, Info, Megaphone, Users } from "lucide-react";
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
import { cn } from "@/lib/utils";

/**
 * Sending is one-way and reaches other people's inboxes, so the number of
 * recipients is shown before the send rather than reported after it. The count
 * is read when the dialog opens; the send answers with the count it used, which
 * is the one worth reporting.
 *
 * The terms of a notice never change, so they are the description a screen
 * reader hears on opening. What this particular send would do — how many
 * people, or why nobody — is a panel of its own above the buttons, so the
 * number is read at a glance rather than found inside a paragraph.
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

  const recipients = preview.data?.recipients ?? 0;
  const summary = preview.error
    ? { tone: "refused" as const, icon: CircleAlert, text: preview.error }
    : preview.data === null
      ? {
          tone: "waiting" as const,
          icon: Spinner,
          text: "Counting who would receive this…",
        }
      : preview.data.notified
        ? {
            tone: "refused" as const,
            icon: Info,
            text: "This post has already notified its audience. Publish a correction as a new post.",
          }
        : recipients === 0
          ? {
              tone: "refused" as const,
              icon: Info,
              text: "Nobody else can read this post right now, so there is no one to notify.",
            }
          : {
              tone: "ready" as const,
              icon: Users,
              text: `${count(recipients, "person", "people")} will be notified.`,
            };
  const Icon = summary.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Megaphone className="size-4 shrink-0 text-primary" />
            Notify the audience
          </DialogTitle>
          <DialogDescription>
            Everyone who can already read this discussion gets an in-app
            notification and an email containing this post. The author is not
            notified, and a post can notify its audience only once.
          </DialogDescription>
        </DialogHeader>

        <p
          role="status"
          className={cn(
            "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
            summary.tone === "ready"
              ? "border-primary/30 bg-primary/5"
              : "bg-muted/50 text-muted-foreground",
            preview.error &&
              "border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {summary.text}
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={send} disabled={busy || summary.tone !== "ready"}>
            {busy ? <Spinner className="size-4" /> : null}
            {summary.tone === "ready"
              ? `Notify ${count(recipients, "person", "people")}`
              : "Notify audience"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
