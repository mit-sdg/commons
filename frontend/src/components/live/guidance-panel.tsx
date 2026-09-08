"use client";

import { BookOpen, CircleHelp, FileText, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Short guidance stays attached to its trigger without obscuring the activity. */
export function GuidancePanel({
  audience,
  scope,
  children,
  detail,
  label: customLabel,
}: {
  audience: "ai" | "host" | "help";
  scope: string;
  children: ReactNode;
  detail?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const title = useId();
  const label =
    customLabel ??
    { ai: "References", host: "Host guide", help: "How it works" }[audience];
  const Icon = { ai: FileText, host: BookOpen, help: CircleHelp }[audience];
  if (audience === "help")
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <CircleHelp className="size-4" />
            How it works
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>How it works</DialogTitle>
            <DialogDescription>
              A worked example of running a relay
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-2 text-muted-foreground"
          aria-label={`${label}: ${scope}`}
        >
          <Icon className="size-4" />
          {label}
          {detail ? <span className="text-xs">{detail}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-labelledby={title}
        className={cn(
          "w-[380px] max-w-[calc(100vw-24px)] max-h-[min(80dvh,var(--radix-popover-content-available-height))] overflow-y-auto rounded-xl p-5 shadow-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2
              id={title}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <Icon className="size-4" />
              {label}
            </h2>
            <p className="text-xs text-muted-foreground">{scope}</p>
          </div>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Close ${label.toLowerCase()}`}
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="space-y-5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
