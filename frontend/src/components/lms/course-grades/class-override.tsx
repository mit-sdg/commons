"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/ui/inline-help";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  type CoursePolicy,
  courseGradeActions,
  type StudentGrade,
} from "@/lib/course-grades";
import { shortDate } from "@/lib/format";
import { useProfile } from "@/lib/profiles";
import { overrideLetters } from "./class-helpers";

/** Set or clear a student's override: a letter from the policy's set and a required reason. */
export function OverrideBox({
  grade,
  policy,
  readOnly,
  savedPolicy,
  onChanged,
}: {
  grade: StudentGrade;
  policy: CoursePolicy;
  readOnly: boolean;
  savedPolicy: string | null;
  onChanged: () => void;
}) {
  const override = grade.override;
  const [value, setValue] = useState(override?.value ?? "");
  const [reason, setReason] = useState(override?.reason ?? "");
  const [busy, setBusy] = useState(false);
  const locked = readOnly || savedPolicy === null;
  const letters = overrideLetters(policy);
  if (override && !letters.includes(override.value))
    letters.unshift(override.value);
  const unchanged =
    override !== null &&
    override.value === value &&
    override.reason === reason.trim();

  async function run(
    call: () => Promise<{ ok: boolean; error?: string }>,
  ): Promise<void> {
    setBusy(true);
    const result = await call();
    setBusy(false);
    if (!result.ok) return void toast.error(result.error);
    onChanged();
  }

  return (
    <div className="grid gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly || savedPolicy === null || !value || !reason.trim())
            return;
          const named = savedPolicy;
          void run(() =>
            courseGradeActions.setOverride(
              grade.student,
              value,
              reason.trim(),
              named,
            ),
          );
        }}
      >
        <span className="font-semibold">Override</span>
        <select
          aria-label="Grade"
          className="h-8 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
          value={value}
          disabled={locked || busy}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">Grade</option>
          {letters.map((letter) => (
            <option key={letter} value={letter}>
              {letter}
            </option>
          ))}
        </select>
        <Input
          aria-label="Reason"
          placeholder="Reason, required"
          required
          className="h-8 min-w-0 flex-[1_1_14rem] bg-card"
          value={reason}
          disabled={locked || busy}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={locked || busy || !value || !reason.trim() || unchanged}
        >
          {override ? "Update" : "Set"}
        </Button>
        {override && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={locked || busy}
            onClick={() =>
              void run(() => courseGradeActions.clearOverride(grade.student))
            }
          >
            Clear
          </Button>
        )}
        {!readOnly && savedPolicy === null && (
          <InlineHelp label="Why overrides are off">
            Save this policy before setting an override.
          </InlineHelp>
        )}
      </form>
      {override && (
        <SetBy
          author={override.author}
          value={override.value}
          replaced={override.replaced}
          setAt={override.setAt}
        />
      )}
    </div>
  );
}

/** "Ana Ruiz set B on Nov 2, replacing C." */
function SetBy({
  author,
  value,
  replaced,
  setAt,
}: {
  author: string;
  value: string;
  replaced: string;
  setAt: string | Date;
}) {
  const { me } = useAuth();
  const mine = me?.user === author;
  const profile = useProfile(mine ? null : author);
  const who = mine ? "You" : (profile?.displayName ?? "Someone");
  return (
    <p className="text-xs text-muted-foreground">
      {who} set {value} on {shortDate(setAt)}
      {replaced ? `, replacing ${replaced}.` : "."}
    </p>
  );
}
