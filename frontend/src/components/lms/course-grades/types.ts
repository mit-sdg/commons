import type React from "react";
import type {
  CourseGradeInputs,
  CourseGradesPage,
  CoursePolicy,
  PolicySummary,
  ShowAs,
  StudentGrade,
} from "@/lib/course-grades";

/** The policy open in the pane: saved, or new and not saved yet. */
export interface OpenPolicy {
  /** Null until the policy is first saved. */
  policy: string | null;
  name: string;
  /** The version this edit was loaded from; null for a new policy. */
  version: number | null;
  authorName: string | null;
  savedAt: string | null;
  final: boolean;
}

/** A save refused because someone saved since this edit was loaded. */
export interface SaveConflict {
  authorName: string;
  savedAt: string;
  version: number;
  /** "Team 30 → 40", from `changesBetween`. */
  changes: string[];
}

export interface PolicyPaneProps {
  inputs: CourseGradeInputs;
  policy: CoursePolicy;
  onChange: (policy: CoursePolicy) => void;
  open: OpenPolicy;
  policies: PolicySummary[];
  /** Whether the edit differs from the saved version. */
  dirty: boolean;
  /** Staff without Grade policies see the pane, read only. */
  readOnly: boolean;
  conflict: SaveConflict | null;
  onOpenPolicy: (policy: string) => void;
  onNewPolicy: () => void;
  onSave: () => Promise<void>;
  onSaveCopy: (name: string) => Promise<void>;
  onReload: () => Promise<void>;
  onRename: (name: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onMarkFinal: () => Promise<void>;
}

/** What the open policy is compared with. */
export interface Comparison {
  /** "Latest per skill", "Course guide, saved", or "What students see". */
  name: string;
  policy: CoursePolicy;
  grades: StudentGrade[];
  differsIn: string[];
}

export interface ClassPaneProps {
  inputs: CourseGradeInputs;
  policy: CoursePolicy;
  /** Lines dragged on the dot strip change the open policy. */
  onChange: (policy: CoursePolicy) => void;
  grades: StudentGrade[];
  comparison: Comparison | null;
  showAs: ShowAs;
  sections: CourseGradesPage["sections"];
  readOnly: boolean;
  /** The open policy's saved identity, which an override names; null before its first save. */
  savedPolicy: string | null;
  onChanged: () => void;
  studentActions?: (student: string) => React.ReactNode;
}

export interface ReleaseProps {
  page: CourseGradesPage;
  readOnly: boolean;
  onChanged: () => void;
}
