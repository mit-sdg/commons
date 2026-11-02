"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { type CourseGradesPage, courseGradeActions } from "@/lib/course-grades";
import { shortDate } from "@/lib/format";
import {
  historyRows,
  latestRelease,
  openRelease,
  releaseOf,
  settingsWords,
  sinceRelease,
} from "./release-helpers";
import type { ReleaseProps } from "./types";

/** The staff line about what students see, with the release history; nothing before the first release. */
export function ReleaseStatus({ page, readOnly, onChanged }: ReleaseProps) {
  const latest = latestRelease(page);
  const release = latest ? releaseOf(latest) : null;
  const since = latest?.open ? sinceRelease(page, latest, new Date()) : null;
  if (!latest || !release) return null;

  async function hide() {
    const result = await courseGradeActions.hide();
    if (!result.ok)
      return void toast.error(
        result.code === "CONFLICT" ? "Nothing is released." : result.error,
      );
    onChanged();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
          <span className="font-medium">
            {latest.open
              ? `Released to students ${shortDate(latest.openedAt)}`
              : `Hidden from students ${shortDate(latest.closedAt)}`}
          </span>
          <span className="text-muted-foreground">
            {release.policy.name}, version {release.policy.version}
          </span>
          <span className="text-muted-foreground">
            Work due by {shortDate(release.settings.dueBy)}
          </span>
          {since?.changed && (
            <Badge variant="outline">Changed since release</Badge>
          )}
        </div>
        {since && since.stale > 0 && (
          <span className="text-sm text-muted-foreground">
            {since.stale === 1
              ? "1 released copy no longer matches current grades"
              : `${since.stale} released copies no longer match current grades`}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <History page={page} />
        {latest.open && !readOnly && (
          <ConfirmAction
            trigger={
              <Button variant="outline" size="sm">
                Hide from students
              </Button>
            }
            title="Hide from students?"
            description="Students see “Course grade withdrawn for review.” until you release again."
            confirmLabel="Hide"
            destructive
            onConfirm={hide}
          />
        )}
      </div>
    </div>
  );
}

function History({ page }: { page: CourseGradesPage }) {
  const rows = historyRows(page);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Release history</DialogTitle>
        </DialogHeader>
        <ol className="grid gap-3">
          {rows.map((row) => (
            <li
              key={row.edition}
              className="grid gap-1.5 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm">
                <span className="font-medium">{shortDate(row.openedAt)}</span>
                {row.authorName && (
                  <span className="text-muted-foreground">
                    {row.authorName}
                  </span>
                )}
                {row.ended && (
                  <span className="text-muted-foreground">
                    {row.ended.word} {shortDate(row.ended.at)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
                <span>
                  {row.policyName}, version {row.version}
                </span>
                <span>Work due by {shortDate(row.settings.dueBy)}</span>
                <span>{row.held} held</span>
              </div>
              {settingsWords(row.settings).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {settingsWords(row.settings).map((word) => (
                    <Badge key={word} variant="secondary">
                      {word}
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/** "Update this student": re-release one student's card under the open release, with a reason. */
export function UpdateStudent({
  student,
  page,
  onChanged,
}: {
  student: string;
  page: CourseGradesPage;
  onChanged: () => void;
}) {
  const [reason, setReason] = useState("");
  const entry = openRelease(page);
  const release = entry ? releaseOf(entry) : null;
  if (!release) return null;
  const name =
    page.inputs.students.find((entry) => entry.user === student)?.name ?? "";

  async function update() {
    const result = await courseGradeActions.updateStudent(
      student,
      reason.trim(),
    );
    if (!result.ok)
      return void toast.error(
        result.code === "CONFLICT" ? "Nothing is released." : result.error,
      );
    setReason("");
    toast.success("Updated.");
    onChanged();
  }

  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm">
          Update this student
        </Button>
      }
      title="Update this student"
      description={
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span className="text-foreground">{name}</span>
            <span>
              {release.policy.name}, version {release.policy.version}
            </span>
            <span>Work due by {shortDate(release.settings.dueBy)}</span>
          </div>
          <label className="grid gap-1.5 text-foreground">
            <span className="text-sm font-medium">Reason</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Regrade of P3"
            />
          </label>
        </div>
      }
      confirmLabel="Update"
      confirmDisabled={reason.trim() === ""}
      onConfirm={update}
    />
  );
}
