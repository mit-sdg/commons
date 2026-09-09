"use client";
import { StandardManager } from "@/components/lms/grade-setup";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
export default function SkillsPage() {
  return (
    <RequireCapability capability="grade">
      <PageContainer>
        <PageHeader title="Skills & rubrics" />
        <StandardManager />
      </PageContainer>
    </RequireCapability>
  );
}
