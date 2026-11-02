"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NameProps {
  title: string;
  confirmLabel: string;
  initial: string;
  onSubmit: (name: string) => Promise<void>;
}

/** Asks for a policy's name, for Save a copy and Rename. */
export function PolicyNameDialog({
  open,
  onOpenChange,
  ...form
}: NameProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent aria-describedby={undefined}>
        {/* The content mounts on each open, so the field starts from `initial`. */}
        <NameForm
          {...form}
          busy={busy}
          onSubmit={async (name) => {
            setBusy(true);
            try {
              await form.onSubmit(name);
              onOpenChange(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  title,
  confirmLabel,
  initial,
  onSubmit,
  busy,
}: NameProps & { busy: boolean }) {
  const [name, setName] = useState(initial);
  const ready = name.trim() !== "" && !busy;
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void onSubmit(name.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-2">
        <Label htmlFor="policy-name">Name</Label>
        <Input
          id="policy-name"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" aria-disabled={!ready || undefined}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
