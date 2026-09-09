import { GroupView } from "@/components/groups/group-view";
import { RequireAuth } from "@/components/require-auth";
export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { group } = await params;
  const { view } = await searchParams;
  return (
    <RequireAuth>
      <GroupView
        key={group}
        list={group}
        tab={view === "tasks" || view === "members" ? view : "discussions"}
      />
    </RequireAuth>
  );
}
