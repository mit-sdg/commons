"use client";

import { SmilePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { REACTION_KINDS } from "@/lib/constants";
import type { Reaction } from "@/lib/models";
import type { SharedPostControls } from "@/lib/post-controls";
import { useProfile } from "@/lib/profiles";
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

function ReactorName({ user }: { user: string }) {
  const profile = useProfile(user);
  return (
    <span className="font-semibold">{profile?.displayName ?? "Someone"}</span>
  );
}

function ReactionDetails({
  kind,
  users,
  loading,
  error,
}: {
  kind: string;
  users: string[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <span>Loading who reacted…</span>;
  if (error) return <span>Couldn’t load who reacted.</span>;
  if (users.length === 0) return <span>No one has this reaction now.</span>;

  return (
    <span className="inline-block max-w-72 leading-relaxed">
      <span aria-hidden="true">{kind}</span>{" "}
      {users.map((user, index) => (
        <span key={user}>
          {index > 0
            ? index === users.length - 1
              ? users.length === 2
                ? " and "
                : ", and "
              : ", "
            : null}
          <ReactorName user={user} />
        </span>
      ))}{" "}
      reacted
    </span>
  );
}

export function ReactionBar({
  target,
  controls,
}: {
  target: string;
  controls?: SharedPostControls;
}) {
  const { session, me } = useAuth();
  const [detailsRequested, setDetailsRequested] = useState(false);
  const details = useQuery<{
    reactions: Reaction[];
  }>(
    controls && !detailsRequested
      ? null
      : () => api.reactions.forTarget({ target }),
    [target, detailsRequested],
  );

  const reactions = useMemo(
    () => details.data?.reactions ?? [],
    [details.data],
  );
  const myId = me ? String(me.user) : null;

  const groups = useMemo(() => {
    if (controls)
      return controls.data.reactions.map(
        ({ kind, count, mine }) => [kind, { count, mine }] as const,
      );
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const prev = map.get(r.kind) ?? { count: 0, mine: false };
      map.set(r.kind, {
        count: prev.count + 1,
        mine: prev.mine || String(r.user) === myId,
      });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [reactions, myId, controls]);

  const usersByKind = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const reaction of reactions) {
      const users = map.get(reaction.kind) ?? [];
      users.push(String(reaction.user));
      map.set(reaction.kind, users);
    }
    return map;
  }, [reactions]);

  function requestDetails(open: boolean) {
    if (!open || !controls) return;
    if (!detailsRequested) setDetailsRequested(true);
    else if (details.error) details.refetch();
  }

  async function toggle(kind: string, mine: boolean) {
    if (!session) {
      toast.error("Sign in to react.");
      return;
    }
    const result = mine
      ? await api.reactions.remove({ target, kind })
      : await api.reactions.add({ target, kind });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      controls?.refetch();
      if (!controls || detailsRequested) details.refetch();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map(([kind, { count, mine }]) => (
        <Tooltip key={kind} onOpenChange={requestDetails}>
          <TooltipTrigger asChild>
            <button
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
              <span className="text-xs font-semibold tabular-nums">
                {count}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6}>
            <ReactionDetails
              kind={kind}
              users={usersByKind.get(kind) ?? []}
              loading={details.loading}
              error={details.error}
            />
          </TooltipContent>
        </Tooltip>
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
