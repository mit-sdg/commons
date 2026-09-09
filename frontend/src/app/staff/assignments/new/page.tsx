"use client";
import { useRouter } from "next/navigation";
import { Link } from "@/components/link";
import { AssignmentForm } from "@/components/lms/assignment-form";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
export default function NewAssignmentPage() {
  const router = useRouter();
  return (
    <RequireCapability capability="course:manage">
      <PageContainer>
        <Link
          href="/staff/assignments"
          className="text-sm text-muted-foreground"
        >
          Back to assignments
        </Link>
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
