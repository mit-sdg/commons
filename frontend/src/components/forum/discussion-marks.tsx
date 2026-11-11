"use client";

import { Pin, PinOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useDiscussionMarks } from "@/lib/discussion-marks";
import { cn } from "@/lib/utils";

/** A star only the signed-in reader sees. */
export function StarButton({
  conversation,
  withLabel = false,
  className,
}: {
  conversation: string;
  withLabel?: boolean;
  className?: string;
}) {
  const { session } = useAuth();
  const { isStarred, toggleStar } = useDiscussionMarks();
  if (!session) return null;
  const starred = isStarred(conversation);
  return (
    <Button
      variant={withLabel ? "outline" : "ghost"}
      size={withLabel ? "sm" : "icon"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggleStar(conversation);
      }}
      aria-label={starred ? "Unstar discussion" : "Star discussion"}
      aria-pressed={starred}
      title={starred ? "Starred — only you see this" : "Star for yourself"}
      className={cn(
        withLabel ? "gap-2" : "size-8 text-muted-foreground",
        starred && "text-amber-500 hover:text-amber-600",
        className,
      )}
    >
      <Star className={cn("size-4", starred && "fill-current")} />
      {withLabel ? (starred ? "Starred" : "Star") : null}
    </Button>
  );
}

/** Staff pin a discussion above the list for everyone; others see only the badge. */
export function DiscussionPinButton({
  conversation,
  className,
}: {
  conversation: string;
  className?: string;
}) {
  const { session } = useAuth();
  const { canPin, isPinned, togglePin } = useDiscussionMarks();
  if (!session || !canPin) return null;
  const pinned = isPinned(conversation);
  return (
    <Button
      variant={pinned ? "secondary" : "outline"}
      size="sm"
      onClick={() => void togglePin(conversation)}
      className={cn("gap-2", className)}
      title={
        pinned
          ? "Remove from the top of everyone's list"
          : "Show at the top of everyone's list"
      }
    >
      {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
      {pinned ? "Unpin" : "Pin"}
    </Button>
  );
}

export function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      <Pin className="size-3" />
      Pinned
    </span>
  );
}
