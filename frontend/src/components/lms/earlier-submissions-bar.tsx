"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  api,
  type Output,
  publicErrorMessage,
  requestErrorMessage,
} from "@/lib/api";
import { count } from "@/lib/format";
import { loadGradesForItem, loadSubmissionsForAssignment } from "@/lib/lms";
import { earlierSubmissions } from "@/lib/submitter-rows";

type ForAssignment = Output<"/submissions/for-assignment">;

/**
 * The attempts members handed in before the assignment changed to each team,
 * with the move to their teams; once moved, what the move did, until the page
 * is left.
 */
export function EarlierSubmissionsBar({
  assignment,
  unmoved,
  submissions,
  onMoved,
}: {
  assignment: string;
  unmoved: ForAssignment["unmoved"];
  submissions: ForAssignment["submissions"];
  onMoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [moved, setMoved] = useState<{
    submissions: number;
    teams: number;
    copied: number | null;
  } | null>(null);
  const earlier = earlierSubmissions(unmoved);

  async function move() {
    const before = earlier;
    const known = new Set(submissions.map((row) => String(row.submission)));
    setBusy(true);
    try {
      const result = await api.submissions["move-to-sections"]({ assignment });
      if ("error" in result) {
        toast.error(publicErrorMessage(result.error));
        return;
      }
      let copied: number | null = null;
      try {
        const [fresh, grades] = await Promise.all([
          loadSubmissionsForAssignment(assignment),
          loadGradesForItem(assignment),
        ]);
        const appeared = new Set(
          fresh.submissions
            .filter(
              (row) =>
                !known.has(String(row.submission)) &&
                before.ofTeam.has(String(row.submitter)),
            )
            .map((row) => String(row.submission)),
        );
        copied = grades.grades.filter(
          (grade) =>
            grade.status === "DRAFT" && appeared.has(String(grade.evidence)),
        ).length;
      } catch {
        copied = null;
      }
      setMoved({
        submissions: before.submissions,
        teams: before.teams,
        copied,
      });
    } catch (error) {
      toast.error(requestErrorMessage(error));
    } finally {
      setBusy(false);
      onMoved();
    }
  }

  if (moved)
    return (
      <div
        role="status"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm"
      >
        <span className="font-semibold tabular-nums">
          {count(moved.submissions, "submission")}
        </span>{" "}
        moved to{" "}
        <span className="font-semibold tabular-nums">
          {count(moved.teams, "team")}
        </span>
        .
        {moved.copied ? (
          <span className="tabular-nums">
            {" "}
            {moved.copied === 1
              ? "1 grade was copied as a draft."
              : `${moved.copied} grades were copied as drafts.`}
          </span>
        ) : null}
      </div>
    );
  if (earlier.submissions === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <span>
        <span className="font-semibold tabular-nums">
          {count(earlier.submissions, "submission")}
        </span>{" "}
        from{" "}
        <span className="font-semibold tabular-nums">
          {count(earlier.teams, "team")}
        </span>{" "}
        {earlier.submissions === 1 ? "was" : "were"} handed in before this
        assignment changed to each team.
      </span>
      <Button size="sm" disabled={busy} onClick={move}>
        Move earlier submissions to teams
      </Button>
    </div>
  );
}
