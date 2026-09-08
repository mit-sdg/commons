import { NewDiscussion } from "./new-discussion";

export default async function NewDiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string | string[] }>;
}) {
  const { audience } = await searchParams;
  return (
    <NewDiscussion
      initialAudience={
        audience === "staff" ? "standing:staff" : "standing:everyone"
      }
    />
  );
}
