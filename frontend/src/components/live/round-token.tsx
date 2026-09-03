import type { RoundStanding } from "@/components/live/rounds";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const DISC: Record<Size, string> = {
  sm: "size-5 text-[10px]",
  md: "size-[26px] text-xs",
  lg: "size-10 text-lg",
  xl: "size-[60px] border-2 text-2xl",
};

const TOKEN: Record<Size, string> = {
  sm: "gap-1.5 font-sans text-sm font-medium",
  md: "gap-2 font-display text-[17px] font-semibold",
  lg: "gap-3 font-display text-[28px] font-semibold",
  xl: "gap-[18px] font-display text-[44px] font-semibold",
};

/**
 * The one way a round is named anywhere: a numbered disc and a short title.
 * Open is ember, done is walnut, next is a dashed outline.
 */
export function RoundToken({
  number,
  title,
  standing = "next",
  size = "md",
  className,
}: {
  number: number;
  title?: string;
  standing?: RoundStanding;
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap leading-none",
        TOKEN[size],
        standing === "next" && "text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex flex-none items-center justify-center rounded-full border-[1.5px] font-mono font-medium",
          DISC[size],
          standing === "open" &&
            "border-primary bg-primary text-primary-foreground",
          standing === "done" &&
            "border-foreground bg-foreground text-background",
          standing === "next" &&
            "border-dashed border-muted-foreground text-muted-foreground",
        )}
      >
        {number}
      </span>
      {title === undefined ? null : <span className="truncate">{title}</span>}
    </span>
  );
}

/** Several rounds side by side, discs only unless titles are asked for. */
export function RoundStrip({
  rounds,
  size = "sm",
  titles = false,
  className,
}: {
  rounds: { number: number; title: string; standing: RoundStanding }[];
  size?: Size;
  titles?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {rounds.map((round) => (
        <RoundToken
          key={round.number}
          number={round.number}
          title={titles ? round.title : undefined}
          standing={round.standing}
          size={size}
        />
      ))}
    </span>
  );
}

const SHAPE_WORDS: Record<string, string> = {
  picked: "the piles you pick",
  every: "every pile",
  top: "the top 3",
};

export function shapeWords(shape: string): string {
  return SHAPE_WORDS[shape] ?? shape;
}

/** What a round takes: a chip naming the source round and the shape. */
export function TakesChip({
  from,
  shape,
  size = "md",
  className,
}: {
  from: number;
  shape: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-background text-muted-foreground",
        size === "lg"
          ? "py-[5px] pr-3.5 pl-1.5 text-base"
          : "py-[3px] pr-2.5 pl-1 text-[13px]",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex flex-none items-center justify-center rounded-full bg-foreground font-mono text-background",
          size === "lg" ? "size-6 text-xs" : "size-[18px] text-[10px]",
        )}
      >
        {from}
      </span>
      {shapeWords(shape)}
    </span>
  );
}

/** A number with a hairline track: the one figure a screen shows. */
export function Figure({
  value,
  of,
  size = "md",
  className,
}: {
  value: number;
  of?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const share = of === undefined || of === 0 ? 0 : Math.min(1, value / of);
  return (
    <span
      className={cn(
        "flex min-w-[120px] flex-col gap-1.5",
        size === "sm" && "min-w-[90px] gap-1",
        className,
      )}
    >
      <span
        className={cn(
          "whitespace-nowrap font-display font-semibold leading-none tabular-nums",
          size === "sm"
            ? "text-lg"
            : size === "lg"
              ? "text-[56px]"
              : "text-3xl",
        )}
      >
        {value}
        {of === undefined ? null : (
          <small
            className={cn(
              "ml-1.5 font-sans font-normal text-muted-foreground",
              size === "sm"
                ? "text-xs"
                : size === "lg"
                  ? "text-2xl"
                  : "text-sm",
            )}
          >
            of {of}
          </small>
        )}
      </span>
      {of === undefined ? null : (
        <span
          className={cn(
            "overflow-hidden rounded-sm bg-border",
            size === "lg" ? "h-[5px]" : "h-[3px]",
          )}
        >
          <i
            className="block h-full bg-primary"
            style={{ width: `${Math.round(share * 100)}%` }}
          />
        </span>
      )}
    </span>
  );
}
