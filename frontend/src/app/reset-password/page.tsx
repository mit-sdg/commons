import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { LoadingState } from "@/components/states";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading reset…" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
