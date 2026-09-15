"use client";

import { AlertTriangle, Download, RefreshCw, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Fact, Facts } from "@/components/facts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, requestErrorMessage } from "@/lib/api";
import {
  ALL_GRADERS,
  filterForGrader,
  type GraderFilter,
  graderFromFilter,
  MY_GRADING,
  UNASSIGNED,
} from "@/lib/delegation-filter";
import type { AvailableGrader, DelegationRow } from "@/lib/submissions-export";

/** A select needs a value for nobody; account identities cannot be empty. */
const NOBODY = "__unassigned__";

export function graderLabel(
  grader: Pick<AvailableGrader, "displayName" | "username">,
): string {
  return grader.displayName ?? grader.username;
}

function delegationLabel(delegation: DelegationRow): string {
  return (
    delegation.graderName ??
    delegation.graderUsername ??
    String(delegation.grader)
  );
}

export function GraderSelect({
  item,
  learner,
  learnerLabel,
  graders,
  current,
  disabled,
  onChanged,
}: {
  item: string;
  learner: string;
  learnerLabel: string;
  graders: readonly AvailableGrader[];
  current: DelegationRow | null;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const currentId = current ? String(current.grader) : NOBODY;
  const currentAvailable = graders.some(
    (grader) => String(grader.grader) === currentId,
  );

  async function choose(value: string | null) {
    const selected = value ?? NOBODY;
    if (selected === currentId) return;
    setBusy(true);
    try {
      const result =
        selected === NOBODY
          ? await api.delegation.clear({ item, learner })
          : await api.delegation.set({ item, learner, grader: selected });
      if ("error" in result) {
        toast.error(requestErrorMessage(result));
        return;
      }
      const selectedGrader = graders.find(
        (grader) => String(grader.grader) === selected,
      );
      toast.success(
        selected === NOBODY
          ? `${learnerLabel} is unassigned`
          : `${learnerLabel} assigned to ${
              selectedGrader
                ? graderLabel(selectedGrader)
                : "the selected grader"
            }`,
      );
      onChanged();
    } catch (error) {
      toast.error(requestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-48 space-y-1">
      <Label
        htmlFor={`grader-${learner}`}
        className="text-xs text-muted-foreground"
      >
        Grader
      </Label>
      <Select
        value={currentId}
        onValueChange={choose}
        disabled={disabled || busy}
      >
        <SelectTrigger
          id={`grader-${learner}`}
          size="sm"
          className="w-full sm:w-52"
          aria-label={`Grader for ${learnerLabel}`}
        >
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NOBODY}>Unassigned</SelectItem>
          {current && !currentAvailable ? (
            <SelectItem value={currentId}>
              {delegationLabel(current)} (unavailable)
            </SelectItem>
          ) : null}
          {graders.map((grader) => (
            <SelectItem
              key={String(grader.grader)}
              value={String(grader.grader)}
            >
              {graderLabel(grader)} (@{grader.username})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && !currentAvailable ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Unavailable — choose a replacement or unassign.
        </p>
      ) : null}
    </div>
  );
}

function SpreadGradersDialog({
  item,
  graders,
  allLearners,
  visibleLearners,
  byLearner,
  disabled,
  onChanged,
}: {
  item: string;
  graders: readonly AvailableGrader[];
  allLearners: readonly string[];
  visibleLearners: readonly string[];
  byLearner: ReadonlyMap<string, string>;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [scope, setScope] = useState<"visible" | "all">("visible");
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const targets = scope === "all" ? allLearners : visibleLearners;
  const currentlyUnassigned = targets.filter(
    (learner) => !byLearner.has(learner),
  ).length;

  function reset() {
    setChosen(graders.map((grader) => String(grader.grader)));
    setScope("visible");
    setReplace(false);
  }

  async function spread() {
    if (chosen.length === 0 || targets.length === 0) return;
    setBusy(true);
    try {
      const result = await api.delegation.spread({
        item,
        learners: [...targets],
        graders: [...chosen],
        replace,
      });
      if ("error" in result) {
        toast.error(requestErrorMessage(result));
        return;
      }
      const changed = result.assigned.length;
      const kept = targets.length - changed;
      toast.success(
        replace
          ? `${changed} ${changed === 1 ? "learner" : "learners"} redistributed`
          : `${changed} ${changed === 1 ? "learner" : "learners"} assigned; ${kept} kept their current grader`,
      );
      setOpen(false);
      onChanged();
    } catch (error) {
      toast.error(requestErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={
            disabled || graders.length === 0 || allLearners.length === 0
          }
        >
          <UsersRound className="size-4" /> Assign in bulk…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign graders in bulk</DialogTitle>
          <DialogDescription>
            Commons balances this assignment against each selected grader’s
            current workload.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Graders taking part</legend>
          <div className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
            {graders.map((grader) => {
              const id = String(grader.grader);
              const load = allLearners.filter(
                (learner) => byLearner.get(learner) === id,
              ).length;
              return (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-3 p-2.5 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={chosen.includes(id)}
                    onChange={(event) =>
                      setChosen((current) =>
                        event.target.checked
                          ? [...current, id]
                          : current.filter((value) => value !== id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {graderLabel(grader)} (@{grader.username})
                  </span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {load} current
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Learners in scope</legend>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              className="mt-0.5"
              type="radio"
              name="delegation-scope"
              checked={scope === "visible"}
              disabled={busy || visibleLearners.length === 0}
              onChange={() => setScope("visible")}
            />
            <span>
              Current view ({visibleLearners.length})
              <span className="block text-xs text-muted-foreground">
                Includes visible learners with missing work.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              className="mt-0.5"
              type="radio"
              name="delegation-scope"
              checked={scope === "all"}
              disabled={busy}
              onChange={() => setScope("all")}
            />
            <span>All learners ({allLearners.length})</span>
          </label>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
          <input
            className="mt-0.5"
            type="checkbox"
            checked={replace}
            disabled={busy}
            onChange={(event) => setReplace(event.target.checked)}
          />
          <span>
            Redistribute learners who already have a grader
            <span className="block text-xs text-muted-foreground">
              Off by default. When off, assignments made since this dialog
              opened are preserved too.
            </span>
          </span>
        </label>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {chosen.length === 0
            ? "Choose at least one grader."
            : targets.length === 0
              ? "No learners are in this scope."
              : replace
                ? `${targets.length} current assignments will be balanced again.`
                : `${currentlyUnassigned} currently unassigned; existing ownership will be preserved.`}
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={spread}
            disabled={busy || chosen.length === 0 || targets.length === 0}
          >
            {busy
              ? "Assigning…"
              : replace
                ? "Redistribute"
                : "Assign unassigned"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function graderFilterLabel(
  filter: GraderFilter,
  graders: readonly AvailableGrader[],
  delegations: readonly DelegationRow[],
): string {
  if (filter === MY_GRADING) return "you";
  const id = graderFromFilter(filter);
  const grader = graders.find((candidate) => String(candidate.grader) === id);
  if (grader) return graderLabel(grader);
  const delegation = delegations.find(
    (candidate) => String(candidate.grader) === id,
  );
  return delegation
    ? `${delegationLabel(delegation)} (unavailable)`
    : "Unavailable grader";
}

export function GradingDelegationToolbar({
  item,
  filter,
  onFilter,
  graders,
  delegations,
  allLearners,
  visibleLearners,
  visibleSubmitted,
  byLearner,
  loading,
  error,
  refreshing,
  exporting,
  onRetry,
  onChanged,
  onRefresh,
  onExport,
}: {
  item: string;
  filter: GraderFilter;
  onFilter: (filter: GraderFilter) => void;
  graders: readonly AvailableGrader[];
  delegations: readonly DelegationRow[];
  allLearners: readonly string[];
  visibleLearners: readonly string[];
  visibleSubmitted: number;
  byLearner: ReadonlyMap<string, string>;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  exporting: boolean;
  onRetry: () => void;
  onChanged: () => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  const unavailable = delegations.filter(
    (row, index, rows) =>
      !graders.some((grader) => String(grader.grader) === String(row.grader)) &&
      rows.findIndex(
        (candidate) => String(candidate.grader) === String(row.grader),
      ) === index,
  );
  const unassigned = visibleLearners.filter(
    (learner) => !byLearner.has(learner),
  ).length;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 space-y-1">
          <Label
            htmlFor="grader-filter"
            className="text-xs text-muted-foreground"
          >
            Grader scope
          </Label>
          <Select
            value={filter}
            onValueChange={(value) => onFilter(value as GraderFilter)}
            disabled={loading || Boolean(error)}
          >
            <SelectTrigger id="grader-filter" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GRADERS}>All learners</SelectItem>
              <SelectItem value={MY_GRADING}>Assigned to me</SelectItem>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {graders.map((grader) => (
                <SelectItem
                  key={String(grader.grader)}
                  value={filterForGrader(String(grader.grader))}
                >
                  {graderLabel(grader)} (@{grader.username})
                </SelectItem>
              ))}
              {unavailable.map((row) => (
                <SelectItem
                  key={String(row.grader)}
                  value={filterForGrader(String(row.grader))}
                >
                  {delegationLabel(row)} (unavailable)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <SpreadGradersDialog
            item={item}
            graders={graders}
            allLearners={allLearners}
            visibleLearners={visibleLearners}
            byLearner={byLearner}
            disabled={loading || Boolean(error)}
            onChanged={onChanged}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onExport}
            disabled={exporting || loading || Boolean(error)}
          >
            <Download className="size-4" />
            {exporting ? "Preparing CSV…" : "Export current view"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading grader assignments…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 text-sm text-destructive"
        >
          <AlertTriangle className="size-4" />
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : (
        <Facts className="text-sm text-muted-foreground">
          <Fact.Count>
            Showing {visibleLearners.length} of {allLearners.length} learners
          </Fact.Count>
          <Fact.Count
            n={visibleSubmitted}
            noun="submitted"
            plural="submitted"
          />
          <Fact.Count n={unassigned} noun="unassigned" plural="unassigned" />
          {filter !== ALL_GRADERS && filter !== UNASSIGNED ? (
            <Fact.Where preposition="Assigned to">
              {graderFilterLabel(filter, graders, delegations)}
            </Fact.Where>
          ) : null}
        </Facts>
      )}
      <p className="text-xs text-muted-foreground">
        CSV uses a fresh copy of this scope and one row per learner, choosing
        the latest submitted attempt; withdrawn-only and missing work remain
        listed.
      </p>
    </div>
  );
}

export type { GraderFilter };
