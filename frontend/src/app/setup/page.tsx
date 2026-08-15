import type { Metadata } from "next";
import { AdminSetupForm } from "@/components/admin-setup-form";

export const metadata: Metadata = {
  title: "Initial administrator setup",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SetupPage() {
  return <AdminSetupForm />;
}
