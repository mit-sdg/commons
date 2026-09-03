import { cn } from "@/lib/utils";

/**
 * The one word a row ever carries. A row says nothing about itself unless a
 * run is open on it; while one row on the shelf is live every row holds the
 * column, so the titles line up under it.
 */
export function StateWord({ live }: { live: boolean }) {
  return (
    <span className="inline-flex w-[54px] flex-none items-center gap-1.5 font-mono text-muted-foreground text-xs">
      {live ? (
        <>
          <span className="inline-block size-2 flex-none rounded-full bg-primary" />
          live
        </>
      ) : null}
    </span>
  );
}

/** The room code a live run is joined by, in the column the figure holds. */
export function RoomCode({ code }: { code: string }) {
  return (
    <span className="font-mono text-muted-foreground text-[13px]">{code}</span>
  );
}

/**
 * One line of the Live list, and one item of it: the shelf is a list, so a
 * screen reader counts the rows and walks them. Relays and questionnaires
 * share the row so the two read as one list: the same state column, one column
 * for what the row counts or is joined by, and the same place for the actions.
 */
export function LiveRow({
  live,
  stateColumn,
  title,
  middle,
  aside,
  actions,
  className,
}: {
  live: boolean;
  /** Some row on the shelf is live, so every row holds the state column. */
  stateColumn: boolean;
  title: React.ReactNode;
  middle?: React.ReactNode;
  /** The figure while a round is open, the room code once it is launched. */
  aside?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3",
        live && "border-primary/40",
        className,
      )}
    >
      {stateColumn ? <StateWord live={live} /> : null}
      {/* Half the row is the title's own: the strip and the actions wrap under
          it rather than squeezing it to one letter per line. */}
      <span className="flex min-w-0 shrink grow basis-1/2 flex-wrap items-center gap-2 font-medium">
        {title}
      </span>
      {middle}
      <span className="hidden min-w-[90px] sm:block">{aside}</span>
      {actions ? (
        <span className="flex flex-wrap items-center gap-2">{actions}</span>
      ) : null}
    </li>
  );
}
