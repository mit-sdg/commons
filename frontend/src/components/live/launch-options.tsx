"use client";

import { type ReactNode, useState } from "react";
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

/** The callers keep their launch requests; this dialog only chooses access. */
export function LaunchOptions({
  trigger,
  onLaunch,
  busy,
  disabled = false,
}: {
  trigger: ReactNode;
  onLaunch: (requireSignIn: boolean) => void | Promise<void>;
  busy: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [requireSignIn, setRequireSignIn] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy || (next && disabled)) return;
        if (next) setRequireSignIn(false);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Launch live interaction</DialogTitle>
          <DialogDescription>
            Choose who can participate in this run.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-primary"
            checked={requireSignIn}
            disabled={busy}
            onChange={(event) => setRequireSignIn(event.target.checked)}
          />
          <span>
            <span className="font-medium">Require sign-in</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              When enabled, anyone with an account can participate. Answers are
              linked to their account; names remain hidden on the wall.
            </span>
          </span>
        </label>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) void onLaunch(requireSignIn);
            }}
          >
            {busy ? "Launching…" : "Launch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
