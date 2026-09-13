import { GroupView } from "@/components/groups/group-view";
import { RequireAuth } from "@/components/require-auth";
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ view?: string; task?: string | string[] }>;
}) {
  const { group } = await params;
  const { view, task } = await searchParams;
  return (
    <RequireAuth>
      <GroupView
        key={group}
        list={group}
        tab={view === "tasks" || view === "members" ? view : "discussions"}
        focusTask={typeof task === "string" ? task : undefined}
      />
    </RequireAuth>
  );
}
