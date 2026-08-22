"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = false,
  open: openProp,
  onOpenChange,
}: {
  /** Omit when the opener cannot host the trigger, such as a menu item. */
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  /** Pass both to drive the dialog from outside; omit both to let it govern itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const governed = openProp !== undefined;
  const open = governed ? openProp : selfOpen;

  function setOpen(next: boolean) {
    if (!governed) setSelfOpen(next);
    onOpenChange?.(next);
  }

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
