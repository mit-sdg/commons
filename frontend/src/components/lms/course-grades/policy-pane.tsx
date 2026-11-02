"use client";

import { PolicyGroups } from "./policy-groups";
import { PolicyHeader } from "./policy-header";
import { AttendanceRules, GradeLines, RatingValues } from "./policy-settings";
import type { PolicyPaneProps } from "./types";

/** The policy pane: what a policy says, and saving it. */
export function PolicyPane({
  inputs,
  policy,
  onChange,
  readOnly,
  ...header
}: PolicyPaneProps) {
  const settings = { policy, onChange, readOnly };
  return (
    <aside
      aria-label="Policy"
      className="grid gap-5 rounded-xl border bg-card p-4 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto"
    >
      <PolicyHeader readOnly={readOnly} {...header} />
      <RatingValues {...settings} />
      <PolicyGroups inputs={inputs} {...settings} />
      <AttendanceRules {...settings} />
      <GradeLines {...settings} />
    </aside>
  );
}
