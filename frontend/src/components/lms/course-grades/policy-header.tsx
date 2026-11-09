"use client";

import { Check, ChevronDown, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineHelp } from "@/components/ui/inline-help";
import { courseTimezone } from "@/lib/course";
import { dateTime, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PolicyNameDialog } from "./policy-name-dialog";
import type { PolicyPaneProps, SaveConflict } from "./types";

type HeaderProps = Omit<
  PolicyPaneProps,
  "inputs" | "policy" | "saved" | "onChange"
>;

/** What Final means, said the same way beside the badge and beside Download. */
export const FINAL_HINT =
  "The final policy is the one Download uses, as last saved. Only one policy is final. Nothing goes to students.";

/** "at 3:12 PM" today, "on Nov 1, 3:12 PM" on another day. */
function whenSaved(savedAt: string): string {
  if (shortDate(savedAt) !== shortDate(new Date()))
    return `on ${dateTime(savedAt)}`;
  return `at ${new Date(savedAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: courseTimezone(),
  })}`;
}

/** The pane's top: which policy is open, its saved version, and saving it. */
export function PolicyHeader({
  open,
  policies,
  dirty,
  readOnly,
  conflict,
  onOpenPolicy,
  onNewPolicy,
  onSave,
  onSaveCopy,
  onReload,
  onRename,
  onRemove,
  onMarkFinal,
}: HeaderProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<"copy" | "rename" | "delete" | null>(
    null,
  );
  const saved = open.policy !== null;

  async function run(what: string, action: () => Promise<void>) {
    setBusy(what);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  const unsaved = dirty && !readOnly && open.version !== null;
  return (
    <div className="grid gap-3 pb-3.5">
      <div className="grid gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Policy: ${open.name}`}
                className="-ml-1.5 flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-base font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="truncate">{open.name}</span>
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              {policies.map((entry) => (
                <DropdownMenuItem
                  key={entry.policy}
                  onSelect={() => onOpenPolicy(entry.policy)}
                >
                  <Check
                    aria-hidden
                    className={
                      entry.policy === open.policy ? undefined : "invisible"
                    }
                  />
                  <span className="truncate">{entry.name}</span>
                  {entry.final ? (
                    <span className="ml-auto text-xs text-muted-foreground">
                      Final
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              {readOnly ? null : (
                <>
                  {policies.length > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem onSelect={onNewPolicy}>
                    <Plus aria-hidden /> New policy
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {open.final ? (
            <>
              <Badge variant="secondary">Final</Badge>
              <InlineHelp label="Final">{FINAL_HINT}</InlineHelp>
            </>
          ) : null}
          {readOnly ? null : (
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {dirty ? (
                <Button
                  size="sm"
                  aria-disabled={busy !== null || undefined}
                  onClick={() => busy === null && void run("save", onSave)}
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More actions for ${open.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {saved ? (
                    <DropdownMenuItem onSelect={() => setAsking("copy")}>
                      Save a copy
                    </DropdownMenuItem>
                  ) : null}
                  {saved && !open.final ? (
                    <DropdownMenuItem
                      onSelect={() => void run("final", onMarkFinal)}
                    >
                      Mark final
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onSelect={() => setAsking("rename")}>
                    Rename
                  </DropdownMenuItem>
                  {saved && !open.final ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setAsking("delete")}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs",
            unsaved ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {unsaved ? (
            <>
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-foreground"
              />
              Unsaved edits
            </>
          ) : open.version === null || open.savedAt === null ? (
            "Not saved yet"
          ) : (
            `Saved ${dateTime(open.savedAt)}${open.authorName ? ` by ${open.authorName}` : ""}`
          )}
        </p>
      </div>

      {conflict && !readOnly ? (
        <ConflictBanner
          conflict={conflict}
          onSaveCopy={() => setAsking("copy")}
          onReload={() => void run("reload", onReload)}
        />
      ) : null}

      <PolicyNameDialog
        open={asking === "copy"}
        onOpenChange={(next) => setAsking(next ? "copy" : null)}
        title="Save a copy"
        confirmLabel="Save a copy"
        initial={`${open.name} (copy)`}
        onSubmit={onSaveCopy}
      />
      <PolicyNameDialog
        open={asking === "rename"}
        onOpenChange={(next) => setAsking(next ? "rename" : null)}
        title="Rename policy"
        confirmLabel="Rename"
        initial={open.name}
        onSubmit={onRename}
      />
      <ConfirmAction
        open={asking === "delete"}
        onOpenChange={(next) => setAsking(next ? "delete" : null)}
        title={`Delete ${open.name}?`}
        description={
          open.version === null || open.version <= 1
            ? "Its saved version is deleted too."
            : `All ${open.version} saved versions are deleted too.`
        }
        confirmLabel="Delete policy"
        destructive
        onConfirm={onRemove}
      />
    </div>
  );
}

/** Shown when a save is refused because someone saved since this edit was loaded. */
function ConflictBanner({
  conflict,
  onSaveCopy,
  onReload,
}: {
  conflict: SaveConflict;
  onSaveCopy: () => void;
  onReload: () => void;
}) {
  const changes =
    conflict.changes.length > 0 ? `: ${conflict.changes.join(", ")}` : "";
  return (
    <div
      role="alert"
      className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"
    >
      <p>
        {conflict.authorName} saved a newer version{" "}
        {whenSaved(conflict.savedAt)}
        {changes}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onSaveCopy}>
          Save a copy
        </Button>
        <Button size="sm" onClick={onReload}>
          Reload
        </Button>
      </div>
    </div>
  );
}
