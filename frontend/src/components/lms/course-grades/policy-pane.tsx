"use client";

import { PolicyGroups } from "./policy-groups";
import { PolicyHeader } from "./policy-header";
import { AttendanceRules, GradeLines, RatingValues } from "./policy-settings";
import type { PolicyPaneProps } from "./types";

/**
 * The policy pane: what a policy says, step by step in the order a grade is
 * worked out, each step read as it stands until someone edits it.
 */
export function PolicyPane({
  inputs,
  policy,
  saved,
  onChange,
  readOnly,
  ...header
}: PolicyPaneProps) {
  const step = { policy, saved, onChange, readOnly };
  return (
    <aside
      aria-label="Policy"
      className="grid rounded-xl border bg-card px-4 pt-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto"
    >
      <PolicyHeader readOnly={readOnly} {...header} />
      <RatingValues {...step} />
      <PolicyGroups inputs={inputs} {...step} />
      <GradeLines {...step} />
      <AttendanceRules {...step} />
    </aside>
  );
}
