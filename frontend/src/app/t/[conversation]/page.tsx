"use client";

import { use } from "react";
import { ThreadView } from "@/components/forum/thread-view";

export default function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversation: string }>;
  searchParams: Promise<{
    postControls?: string | string[];
    fromGroup?: string | string[];
  }>;
}) {
  const { conversation } = use(params);
  const { postControls, fromGroup } = use(searchParams);
  return (
    <ThreadView
      conversation={conversation}
      fromGroup={typeof fromGroup === "string" ? fromGroup : undefined}
      batchedControls={postControls === "batched"}
    />
  );
}
