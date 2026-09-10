"use client";

import { useProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

/**
 * The course role a person holds, as a quiet pill beside their name. Students
 * hold no role, so the pill appears only on staff and stays absent everywhere
 * else; it reads from the same batched display identity as the name and avatar.
 */
export function UserRole({
  user,
  className,
}: {
  user: string;
  className?: string;
}) {
  const profile = useProfile(user);
  const name = profile?.role?.name;
  if (!name) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-secondary-foreground",
        className,
      )}
    >
      {name}
    </span>
  );
}
