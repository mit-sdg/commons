import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectConsent } from "@/components/connect-consent";
import { LoadingState } from "@/components/states";

export const metadata: Metadata = { title: "Sign in with Commons" };

export default function ConnectPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading sign-in…" />}>
      <ConnectConsent />
    </Suspense>
  );
}
