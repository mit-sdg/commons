"use client";

import { Link } from "@/components/link";
import { useProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function UserName({
  user,
  className,
  fallback = "Someone",
  name,
}: {
  user: string;
  className?: string;
  fallback?: string;
  /** Pass when the caller already has the display name, to skip the profile fetch. */
  name?: string;
}) {
  const profile = useProfile(name ? null : user);
  return (
    <Link
      href={`/u/${user}`}
      className={cn(
        "font-medium text-foreground hover:text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {name ?? profile?.displayName ?? fallback}
    </Link>
  );
}
