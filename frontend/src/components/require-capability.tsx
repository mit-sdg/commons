"use client";

import { Shield } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/states";
import { useAuth } from "@/lib/auth";
import type { Capability } from "@/lib/models";

/**
 * Gate a page on the capability it actually needs.
 *
 * Permissions are already resolved in auth context, so this costs no request,
 * and each page names its own requirement rather than sharing one blanket check
 * that may have nothing to do with what the page does. Passing several
 * capabilities means any one of them is enough.
 */
export function RequireCapability({
  capability,
  children,
}: {
  capability: Capability | Capability[];
  children: React.ReactNode;
}) {
  const { me, loading, permissions } = useAuth();
  const needed = Array.isArray(capability) ? capability : [capability];

  if (loading) return <LoadingState label="Checking access…" />;

  if (!me || !needed.some((entry) => permissions.can(entry))) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={Shield}
          title="You don't have access to this"
          description={
            needed.length === 1
              ? `This page needs the "${needed[0]}" capability. Ask an administrator to assign you a role that carries it.`
              : `This page needs one of: ${needed.join(", ")}. Ask an administrator to assign you a role that carries one.`
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
