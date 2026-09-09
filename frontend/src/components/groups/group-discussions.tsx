"use client";
import { TopicList } from "@/components/forum/topic-list";
import { Link } from "@/components/link";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { loadFeedIndex } from "@/lib/loaders";
export function GroupDiscussions({ group }: { group: string }) {
  const feed = useQuery(() => loadFeedIndex("activity"), [group]);
  const conversations =
    feed.data
      ?.filter((entry) =>
        entry.audience.some((holder) => holder.holder === `group:${group}`),
      )
      .map((entry) => String(entry.conversation)) ?? [];
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Discussions</h2>
        <Button asChild size="sm">
          <Link href={`/new?group=${encodeURIComponent(group)}`}>
            New discussion
          </Link>
        </Button>
      </div>
      {feed.loading && !feed.data ? (
        <LoadingState />
      ) : feed.error ? (
        <ErrorState message={feed.error} onRetry={feed.refetch} />
      ) : conversations.length ? (
        <TopicList
          key={group}
          conversations={conversations}
          fromGroup={group}
        />
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No discussions addressed to this group yet.
        </p>
      )}
    </section>
  );
}
