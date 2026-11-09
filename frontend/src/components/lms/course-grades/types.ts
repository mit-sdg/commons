import type React from "react";
import type {
  CourseGradeInputs,
  CourseGradesPage,
  CoursePolicy,
  PolicySummary,
  ShowAs,
  StudentGrade,
} from "@/lib/course-grades";
import type { CopyShows } from "./class-helpers";

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
  /** The open policy as saved; null before its first save. */
  saved: CoursePolicy | null;
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
  /** Each student's grade under the compared policy; empty for what students see. */
  grades: StudentGrade[];
  /** For what students see: what each student's current copy shows. */
  copies: Map<string, CopyShows> | null;
  differsIn: string[];
}

/** What the open policy can be compared with, shown as buttons over the class. */
export interface CompareChoices {
  /**
   * "Saved" while there are unsaved edits, "What students see", then each
   * other saved policy. `count` is how many students change letter, known
   * live only for Saved.
   */
  options: { key: string; name: string; count: number | null }[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}

export interface ClassPaneProps {
  inputs: CourseGradeInputs;
  policy: CoursePolicy;
  /** Lines dragged on the dot strip change the open policy. */
  onChange: (policy: CoursePolicy) => void;
  grades: StudentGrade[];
  comparison: Comparison | null;
  compare: CompareChoices;
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
