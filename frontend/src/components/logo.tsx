import { cn } from "@/lib/utils";

/**
 * The Commons mark. Three concept blocks composed by two syncs, and a fourth
 * concept lifting in from the corner: an application assembled from
 * independent parts, the way this one is. It sits on the ember tile in the
 * header and stands alone as the site icon.
 */
export function CommonsMark({
  className,
  title = "Commons",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("size-9 shrink-0 text-primary", className)}
    >
      <rect width="64" height="64" rx="16" fill="currentColor" />
      <g fill="var(--primary-foreground)">
        <rect x="15" y="15" width="16" height="16" rx="4.5" />
        <rect x="15" y="33" width="16" height="16" rx="4.5" />
        <rect x="33" y="33" width="16" height="16" rx="4.5" />
        <circle cx="23" cy="32" r="2.7" />
        <circle cx="32" cy="41" r="2.7" />
      </g>
      <rect
        x="34"
        y="14"
        width="16"
        height="16"
        rx="4.5"
        fill="#000"
        opacity="0.28"
        transform="rotate(12 42 22)"
      />
      <rect
        x="36"
        y="12"
        width="16"
        height="16"
        rx="4.5"
        fill="var(--primary-foreground)"
        transform="rotate(12 44 20)"
      />
    </svg>
  );
}

export function CommonsLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <CommonsMark />
      <span className="hidden font-display text-xl font-semibold tracking-tight @sm:inline">
        Commons
      </span>
    </span>
  );
}
