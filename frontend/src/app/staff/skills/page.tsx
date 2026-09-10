"use client";
import { StandardManager } from "@/components/lms/grade-setup";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
export default function SkillsPage() {
  return (
    <RequireCapability capability="grade">
      <PageContainer>
        <PageHeader
          eyebrow="Staff"
          title="Skills and rubrics"
          description="The skills this course assesses, and the rubric edition each one is judged by."
        />
        <StandardManager />
      </PageContainer>
    </RequireCapability>
  );
}
