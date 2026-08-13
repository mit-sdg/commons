"use client";

import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  item,
  withLabel = false,
}: {
  item: string;
  withLabel?: boolean;
}) {
  const { session } = useAuth();
  const { data, refetch } = useQuery<{ saved: boolean }>(
    session ? () => api.bookmarks.isSaved({ item }) : null,
    [session, item],
  );
  const saved = data?.saved ?? false;

  async function toggle() {
    if (!session) {
      toast.error("Sign in to bookmark posts.");
      return;
    }
    const result = saved
      ? await api.bookmarks.unsave({ item })
      : await api.bookmarks.save({ item });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(saved ? "Bookmark removed" : "Bookmarked");
      refetch();
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={saved ? "Remove bookmark" : "Bookmark post"}
      aria-pressed={saved}
      className={cn("gap-1.5 text-muted-foreground", saved && "text-primary")}
    >
      <Bookmark className={cn("size-4", saved && "fill-current")} />
      {withLabel ? (saved ? "Saved" : "Save") : null}
    </Button>
  );
}
