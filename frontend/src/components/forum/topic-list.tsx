"use client";

import { useState } from "react";
import { TopicRow } from "@/components/forum/topic-row";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { loadThreadSummaries } from "@/lib/loaders";

function TopicPage({
  conversations,
  offset,
  more,
  onLoadMore,
  fromGroup,
}: {
  conversations: string[];
  offset: number;
  more: boolean;
  onLoadMore: () => void;
  fromGroup?: string;
}) {
  const { data, loading, error, refetch } = useQuery(
    () => loadThreadSummaries(conversations),
    [JSON.stringify(conversations)],
  );
  if (loading && !data) return <LoadingState label="Loading discussions…" />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  return (
    <>
      {data?.map((summary, index) => (
        <TopicRow
          key={String(summary.conversation)}
          summary={summary}
          fromGroup={fromGroup}
          index={offset + index}
        />
      ))}
      {data?.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">
          These discussions are no longer available.
        </p>
      ) : null}
      {more ? (
        <div className="px-3 py-5">
          <Button variant="outline" onClick={onLoadMore}>
            Load more discussions
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function TopicList({
  conversations,
  fromGroup,
}: {
  conversations: string[];
  fromGroup?: string;
}) {
  const [pages, setPages] = useState(1);
  const shownPages = Math.min(pages, Math.ceil(conversations.length / 25));
  return (
    <div className="-mx-3">
      {Array.from({ length: shownPages }, (_, page) => (
        <TopicPage
          key={page}
          fromGroup={fromGroup}
          conversations={conversations.slice(page * 25, (page + 1) * 25)}
          offset={page * 25}
          more={
            page === shownPages - 1 && (page + 1) * 25 < conversations.length
          }
          onLoadMore={() => setPages((value) => value + 1)}
        />
      ))}
    </div>
  );
}
