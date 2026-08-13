import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { LoadingState } from "@/components/states";

export const metadata: Metadata = { title: "Join" };

export default function RegisterPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading invitation…" />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
