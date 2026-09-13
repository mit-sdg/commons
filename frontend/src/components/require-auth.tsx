"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { signInHref } from "@/lib/sign-in-return";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) {
      router.replace(
        signInHref(
          window.location.pathname +
            window.location.search +
            window.location.hash,
        ),
      );
    }
  }, [loading, me, router]);

  if (loading) return <LoadingState label="Checking your session…" />;
  if (!me) return <LoadingState label="Redirecting to sign in…" />;
  return <>{children}</>;
}
