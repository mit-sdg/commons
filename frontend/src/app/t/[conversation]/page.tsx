"use client";

import { use } from "react";
import { ThreadView } from "@/components/forum/thread-view";

export default function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ conversation: string }>;
  searchParams: Promise<{ postControls?: string | string[] }>;
}) {
  const { conversation } = use(params);
  const { postControls } = use(searchParams);
  return (
    <ThreadView
      conversation={conversation}
      batchedControls={postControls === "batched"}
    />
  );
}
