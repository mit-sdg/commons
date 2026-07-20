"use client";

import { Link } from "@/components/link";
import { useProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

export function UserName({
  user,
  className,
  fallback = "Someone",
}: {
  user: string;
  className?: string;
  fallback?: string;
}) {
  const profile = useProfile(user);
  return (
    <Link
      href={`/u/${user}`}
      className={cn(
        "font-medium text-foreground hover:text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {profile?.displayName ?? fallback}
    </Link>
  );
}
