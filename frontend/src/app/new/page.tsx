import { NewDiscussion } from "./new-discussion";

export default async function NewDiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string | string[]; group?: string }>;
}) {
  const { audience, group } = await searchParams;
  return (
    <NewDiscussion
      fromGroup={group}
      initialAudience={
        group
          ? `group:${group}`
          : audience === "staff"
            ? "standing:staff"
            : "standing:everyone"
      }
    />
  );
}
