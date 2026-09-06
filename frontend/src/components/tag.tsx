import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The kind of a thing — essay, quiz, student, a role — as a quiet tag:
 * small, uppercase, tracked, muted, no fill. It qualifies a title; it is
 * never a word among metadata. A filled badge means a state; this means a
 * type, and the reader learns the difference once.
 */
export function Tag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
