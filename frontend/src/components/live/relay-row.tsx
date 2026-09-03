import { cn } from "@/lib/utils";

/** Where a relay or a questionnaire stands, in the word the list shows for it. */
export type LiveStanding = "open" | "launched" | "authored" | "closed";

const DOT: Record<LiveStanding, string> = {
  open: "bg-primary",
  launched: "bg-muted-foreground",
  authored: "border border-muted-foreground",
  closed: "bg-foreground",
};

export function StateWord({ standing }: { standing: LiveStanding }) {
  return (
    <span className="inline-flex w-[74px] flex-none items-center gap-1.5 font-mono text-muted-foreground text-xs">
      <span
        className={cn(
          "inline-block size-2 flex-none rounded-full",
          DOT[standing],
        )}
      />
      {standing}
    </span>
  );
}

/** The room code a launched run is joined by, in the column the figure holds. */
export function RoomCode({ code }: { code: string }) {
  return (
    <span className="font-mono text-muted-foreground text-[13px]">{code}</span>
  );
}

/**
 * One line of the Live list. Relays and questionnaires share it so the two
 * read as one list: the same state word, one column for what the row counts
 * or is joined by, and the same place for the actions.
 */
export function LiveRow({
  standing,
  title,
  middle,
  aside,
  actions,
}: {
  standing: LiveStanding;
  title: React.ReactNode;
  middle?: React.ReactNode;
  /** The figure while a round is open, the room code once it is launched. */
  aside?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
        standing === "open" && "border-primary/40",
        standing === "closed" && "opacity-70",
      )}
    >
      <StateWord standing={standing} />
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium">
        {title}
      </span>
      {middle}
      <span className="hidden min-w-[90px] sm:block">{aside}</span>
      <span className="flex flex-wrap items-center gap-2">{actions}</span>
    </div>
  );
}
