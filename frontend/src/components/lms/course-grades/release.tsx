"use client";

import type { CourseGradesPage } from "@/lib/course-grades";
import { ReleaseDialog } from "./release-dialog";
import { ReleaseStatus, UpdateStudent } from "./release-line";
import type { ReleaseProps } from "./types";

/** "Release to students" and its dialog; "Release again" while a release is open. */
export function ReleaseButton(props: ReleaseProps) {
  if (props.readOnly) return null;
  return <ReleaseDialog {...props} />;
}

/** The staff line about what students see, with the release history. */
export function ReleaseLine(props: ReleaseProps) {
  return <ReleaseStatus {...props} />;
}

/** "Update this student", or "Release <name>" for a held student: re-release one student's card with a reason; only while a release is open. */
export function UpdateStudentButton(props: {
  student: string;
  page: CourseGradesPage;
  onChanged: () => void;
}) {
  return <UpdateStudent {...props} />;
}
