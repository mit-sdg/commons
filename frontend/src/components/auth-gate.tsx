"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingState } from "@/components/states";
import { useAuth } from "@/lib/auth";
import { isPublicPath } from "@/lib/public-paths";
import { signInHref } from "@/lib/sign-in-return";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!loading && !me && !isPublic) {
      router.replace(
        signInHref(
          window.location.pathname +
            window.location.search +
            window.location.hash,
        ),
      );
    }
  }, [isPublic, loading, me, router]);

  if (loading) return <LoadingState label="Checking your session…" />;
  if (isPublic) return <>{children}</>;
  if (!me) return <LoadingState label="Redirecting to sign in…" />;
  return <>{children}</>;
}
