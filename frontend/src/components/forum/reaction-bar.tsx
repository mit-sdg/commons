"use client";

import { SmilePlus } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { REACTION_KINDS } from "@/lib/constants";
import type { Reaction } from "@/lib/models";
import { cn } from "@/lib/utils";

const REACTION_LABELS: Record<string, string> = {
  "👍": "thumbs up",
  "❤️": "heart",
  "🎉": "celebrate",
  "😄": "smile",
  "😮": "surprised",
  "🤔": "thinking",
  "👀": "eyes",
  "🙏": "thanks",
};

export function ReactionBar({ target }: { target: string }) {
  const { session, me } = useAuth();
  const { data, refetch } = useQuery<{ reactions: Reaction[] }>(
    () => api.reactions.forTarget({ target }),
    [target],
  );

  const reactions = useMemo(() => data?.reactions ?? [], [data]);
  const myId = me ? String(me.user) : null;

  const groups = useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const prev = map.get(r.kind) ?? { count: 0, mine: false };
      map.set(r.kind, {
        count: prev.count + 1,
        mine: prev.mine || String(r.user) === myId,
      });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [reactions, myId]);

  async function toggle(kind: string, mine: boolean) {
    if (!session) {
      toast.error("Sign in to react.");
      return;
    }
    const result = mine
      ? await api.reactions.remove({ target, kind })
      : await api.reactions.add({ target, kind });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else refetch();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map(([kind, { count, mine }]) => (
        <button
          key={kind}
          type="button"
          onClick={() => toggle(kind, mine)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
            mine
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted",
          )}
          aria-label={`${mine ? "Remove" : "Add"} ${REACTION_LABELS[kind] ?? kind} reaction; ${count} total`}
          aria-pressed={mine}
        >
          <span className="leading-none">{kind}</span>
          <span className="text-xs font-semibold tabular-nums">{count}</span>
        </button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label="Add reaction"
          >
            <SmilePlus className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1.5">
          <div className="flex gap-0.5">
            {REACTION_KINDS.map((kind) => {
              const mine = groups.find(([k]) => k === kind)?.[1].mine ?? false;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggle(kind, mine)}
                  aria-label={`${mine ? "Remove" : "React with"} ${REACTION_LABELS[kind] ?? kind}`}
                  aria-pressed={mine}
                  className={cn(
                    "rounded-md p-2 text-lg transition-transform hover:scale-110 hover:bg-muted",
                    mine && "bg-primary/10",
                  )}
                >
                  {kind}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
