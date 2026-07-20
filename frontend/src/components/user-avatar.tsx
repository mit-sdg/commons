"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { accentFor, initials } from "@/lib/format";
import { useProfile } from "@/lib/profiles";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  user: string;
  name?: string;
  avatar?: string;
  className?: string;
}

export function UserAvatar({ user, name, avatar, className }: UserAvatarProps) {
  const profile = useProfile(name ? null : user);
  const displayName = name ?? profile?.displayName ?? "";
  const src = avatar ?? profile?.avatar ?? "";

  return (
    <Avatar className={cn("size-9 border border-border/70", className)}>
      {src ? <AvatarImage src={src} alt={displayName} /> : null}
      <AvatarFallback
        className="font-medium text-white"
        style={{ backgroundColor: accentFor(user) }}
      >
        {initials(displayName || "?")}
      </AvatarFallback>
    </Avatar>
  );
}
