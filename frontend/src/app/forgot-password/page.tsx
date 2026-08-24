import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import { LoadingState } from "@/components/states";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading…" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
