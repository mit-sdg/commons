import { cn } from "@/lib/utils";

/**
 * A list of like things, each in its own quiet chip. The chip is the list's
 * own form, so a comma inside one of the values — a student's answer, a
 * choice someone wrote — is never read as a boundary between two of them.
 *
 * The size lives on the list, not on the chip, so a caller passes the size
 * the surrounding text uses and every chip follows it.
 */
export function Chips({
  values,
  className,
  struck = false,
}: {
  values: readonly string[];
  className?: string;
  /** What a proposal would take away: the same chip, its words struck. */
  struck?: boolean;
}) {
  if (values.length === 0) return null;
  return (
    <ul
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1.5 text-[13px]",
        className,
      )}
    >
      {values.map((value, index) => (
        <li
          key={`${value}-${index}`}
          data-chip
          dir="auto"
          className={cn(
            "max-w-full shrink-0 truncate rounded-full border border-border bg-background px-2.5 py-[3px] text-muted-foreground",
            struck && "line-through",
          )}
        >
          {value}
        </li>
      ))}
    </ul>
  );
}
