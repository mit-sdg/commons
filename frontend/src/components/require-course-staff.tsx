"use client";

import { Shield } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function RequireCourseStaff({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me } = useAuth();
  const permission = useQuery<{ allowed: boolean }>(
    me
      ? () =>
          api.roles.can({
            user: String(me.user),
            context: "forum",
            capability: "assignments:manage",
          })
      : null,
    [me],
  );

  if (!me || permission.loading) {
    return <LoadingState label="Checking course staff access…" />;
  }

  if (permission.error || !permission.data?.allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={Shield}
          title="Course staff only"
          description="You do not have permission to use the course staff tools."
        />
      </div>
    );
  }

  return <>{children}</>;
}
