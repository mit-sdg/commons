"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { isPublicPath } from "@/lib/public-paths";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!loading && !me && !isPublic) router.replace("/login");
  }, [isPublic, loading, me, router]);

  if (isPublic) return <>{children}</>;
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!me) return <LoadingState label="Redirecting to sign in…" />;
  return <>{children}</>;
}
