import { RequireCourseStaff } from "@/components/require-course-staff";

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireCourseStaff>{children}</RequireCourseStaff>;
}
