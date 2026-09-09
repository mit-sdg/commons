import { redirect } from "next/navigation";
export default async function LegacyTaskList({
  params,
}: {
  params: Promise<{ list: string }>;
}) {
  const { list } = await params;
  redirect(`/groups/${encodeURIComponent(list)}?view=tasks`);
}
