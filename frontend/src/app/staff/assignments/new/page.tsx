"use client";
import { useRouter } from "next/navigation";
import { AssignmentForm } from "@/components/lms/assignment-form";
import { BackLink, PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
export default function NewAssignmentPage() {
  const router = useRouter();
  return (
    <RequireCapability capability="course:manage">
      <PageContainer>
        <BackLink href="/staff/assignments">Back to assignments</BackLink>
        <PageHeader title="New assignment" />
        <AssignmentForm
          onSaved={(assignment) =>
            router.push(`/staff/assignments/${assignment}`)
          }
          onCancel={() => router.push("/staff/assignments")}
        />
      </PageContainer>
    </RequireCapability>
  );
}
