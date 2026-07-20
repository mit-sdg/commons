"use client";

import { Tag as TagIcon } from "lucide-react";
import { use } from "react";
import { PostPreview } from "@/components/forum/post-preview";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { loadPostConversationIndex } from "@/lib/loaders";

export default function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = use(params);

  const targets = useQuery<{ targets: { target: string }[] }>(
    () => api.tags.targetsByName({ name: tag }),
    [tag],
  );
  const targetItems = (targets.data?.targets ?? []).map(({ target }) =>
    String(target),
  );
  const targetIndexKey = targetItems.join("\u0000");
  const index = useQuery<Record<string, string>>(
    targetItems.length > 0
      ? () => loadPostConversationIndex(targetItems)
      : null,
    [targetIndexKey],
  );

  return (
    <PageContainer>
      <PageHeader eyebrow="Tag" title="Tagged posts" />
      {targets.loading && !targets.data ? (
        <LoadingState />
      ) : targets.error ? (
        <ErrorState message={targets.error} onRetry={targets.refetch} />
      ) : !targets.data || targets.data.targets.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No posts with this tag"
          description="Posts tagged here will show up in this list."
        />
      ) : (
        <div className="space-y-4">
          {targets.data.targets.map(({ target }) => (
            <PostPreview
              key={String(target)}
              item={String(target)}
              conversation={index.data?.[String(target)] ?? null}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
