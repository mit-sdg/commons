"use client";

import { ArrowLeft } from "lucide-react";
import { Link } from "@/components/link";
import { BackgroundCard } from "@/components/live/background-card";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";

export default function BackgroundPage() {
  return (
    <RequireCapability capability="live:host">
      <PageContainer width="wide">
        <PageHeader
          eyebrow={
            <Link
              href="/staff/live"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ArrowLeft className="size-3" /> Live
            </Link>
          }
          title="Documents"
          description="Store reference documents here, then choose which ones each activity uses."
        />
        <div className="max-w-3xl">
          <BackgroundCard />
        </div>
      </PageContainer>
    </RequireCapability>
  );
}
