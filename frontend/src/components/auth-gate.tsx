"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/states";
import { useAuth } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const isPublic = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!loading && !me && !isPublic) router.replace("/login");
  }, [isPublic, loading, me, router]);

  if (isPublic) return <>{children}</>;
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!me) return <LoadingState label="Redirecting to sign in…" />;
  return <>{children}</>;
}
