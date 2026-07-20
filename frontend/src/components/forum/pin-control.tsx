"use client";

import { Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function PinControl({
  item,
  scope,
  onChanged,
}: {
  item: string;
  scope: string;
  onChanged?: () => void;
}) {
  const { session, can } = useAuth();
  const { data, refetch } = useQuery<{ pinned: boolean }>(
    () => api.pins.isPinned({ item, scope }),
    [item, scope],
  );
  const pinned = data?.pinned ?? false;

  if (!session || !can.pin) {
    return pinned ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
        <Pin className="size-3.5" />
        Pinned
      </span>
    ) : null;
  }

  async function pin() {
    if (!session) return;
    const result = await api.pins.pin({
      item,
      scope,
      priority: 0,
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Pinned to the top");
      refetch();
      onChanged?.();
    }
  }

  async function unpin() {
    if (!session) return;
    const result = await api.pins.unpin({ item, scope });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Unpinned");
      refetch();
      onChanged?.();
    }
  }

  async function bump() {
    if (!session) return;
    const result = await api.pins.setPriority({
      item,
      scope,
      priority: Date.now(),
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Moved to the top");
      onChanged?.();
    }
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={pinned ? unpin : pin}
        className={cn(
          "gap-1.5 text-muted-foreground",
          pinned && "text-primary",
        )}
      >
        {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        {pinned ? "Unpin" : "Pin"}
      </Button>
      {pinned ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={bump}
          className="text-xs text-muted-foreground"
        >
          Bump
        </Button>
      ) : null}
    </div>
  );
}
