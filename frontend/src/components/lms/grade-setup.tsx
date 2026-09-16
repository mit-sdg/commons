"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type QueryState, useQuery } from "@/hooks/use-query";
import {
  api,
  isClientErrorCode,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  competencyCriteria,
  type GradingMethod,
  type GradingSetup,
  pointCriteria,
  type SetupCriterionInput,
} from "@/lib/grading";
import { sumDecimals } from "../../../../src/computations/decimal-sum.ts";
import { RubricDescription } from "./assessment-history";
import { GradingDataNotice } from "./grading-data-notice";

type Standard = Extract<
  Output<"/grades/standards">,
  { standards: unknown }
>["standards"][number];

const emptyStandard = {
  name: "",
  description: "",
  deficient: "",
  emergent: "",
  competent: "",
  expert: "",
  referenceUrl: "",
};

const standardFields = [
  ["name", "Skill name"],
  ["description", "What this skill concerns"],
  ["deficient", "Deficient"],
  ["emergent", "Emergent"],
  ["competent", "Competent"],
  ["expert", "Expert"],
  ["referenceUrl", "Reference link (optional)"],
] as const;

export function StandardManager({ onChanged }: { onChanged?: () => void }) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.grades.standards({})) : null,
    [session],
  );
  const [editing, setEditing] = useState<Standard | null | undefined>();
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.refetch} />;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Course skills</h2>
        <Button variant="outline" onClick={() => setEditing(null)}>
          New skill
        </Button>
      </div>
      {editing !== undefined && (
        <StandardForm
          key={editing?.edition ?? "new"}
          existing={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            query.refetch();
            onChanged?.();
          }}
        />
      )}
      {query.loading && !query.data ? (
        <LoadingState label="Loading rubrics…" />
      ) : query.data?.standards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a skill, optionally link to its rubric, then select it on an
          assignment.
        </p>
      ) : (
        query.data?.standards.map((rubric) => (
          <div
            key={rubric.standard}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <RubricDescription
              rubric={rubric}
              title={rubric.name}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(rubric)}
                >
                  Revise rubric
                </Button>
              }
            />
          </div>
        ))
      )}
    </section>
  );
}

function StandardForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing: Standard | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(
    existing
      ? (Object.fromEntries(
          standardFields.map(([key]) => [key, existing[key]]),
        ) as typeof emptyStandard)
      : emptyStandard,
  );
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const result = existing
        ? await api.grades["revise-standard"]({
            ...values,
            standard: existing.standard,
            expectedEdition: existing.edition,
          })
        : await api.grades["define-standard"](values);
      if ("error" in result)
        toast.error(
          result.error === "CONFLICT"
            ? "This rubric changed. Reload before issuing another edition."
            : result.error === "INVALID_REQUEST"
              ? "Supply a skill name and, if provided, a valid HTTP or HTTPS reference link."
              : publicErrorMessage(result.error),
        );
      else {
        toast.success("Rubric edition saved");
        onSaved();
      }
    } catch {
      toast.error("Could not save the rubric.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3 className="font-medium">
        {existing ? `Revise ${existing.name}` : "New skill"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {existing
          ? "This creates a new edition. Existing assignments and assessments keep the edition they selected."
          : "Link to your full rubric. Descriptions in Commons are optional."}
      </p>
      {([true, false] as const).map((basic) => {
        const inputs = standardFields
          .filter(
            ([key]) => basic === (key === "name" || key === "referenceUrl"),
          )
          .map(([key, label]) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`standard-${key}`}>{label}</Label>
              {basic ? (
                <Input
                  id={`standard-${key}`}
                  type={key === "referenceUrl" ? "url" : "text"}
                  required={key === "name"}
                  maxLength={key === "referenceUrl" ? 2048 : 10000}
                  value={values[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              ) : (
                <Textarea
                  id={`standard-${key}`}
                  maxLength={10000}
                  value={values[key]}
                  disabled={busy}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          ));
        return basic ? (
          <div key="basic" className="space-y-4">
            {inputs}
          </div>
        ) : (
          <details key="descriptions">
            <summary className="cursor-pointer text-sm">
              Descriptions (optional)
            </summary>
            <div className="mt-3 space-y-3">{inputs}</div>
          </details>
        );
      })}
      <div className="flex gap-2">
        <Button disabled={busy} type="submit">
          Save edition
        </Button>
        <Button
          disabled={busy}
          type="button"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CreationSkills({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const { session } = useAuth();
  const known = useRef<Standard[]>([]);
  const query = useQuery(
    session
      ? async () => {
          const result = unwrap(await api.grades.standards({}));
          const pinned = known.current.filter((rubric) =>
            selected.includes(rubric.edition),
          );
          known.current = [
            ...pinned,
            ...result.standards.filter(
              (rubric) =>
                !pinned.some(
                  (selectedRubric) =>
                    selectedRubric.standard === rubric.standard,
                ),
            ),
          ];
          return { ...result, standards: known.current };
        }
      : null,
    [session],
  );
  const [search, setSearch] = useState("");
  const { refetch } = query;
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === "visible") refetch();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch]);
  return (
    <section className="space-y-3 border-t pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">Skills assessed</h2>
        <Link
          href="/staff/skills"
          target="_blank"
          className="text-xs text-muted-foreground underline"
        >
          Manage skills and rubrics
        </Link>
      </div>
      {query.error ? (
        <ErrorState message={query.error} onRetry={query.refetch} />
      ) : query.loading ? (
        <LoadingState label="Loading skills…" />
      ) : (
        <>
          <Input
            aria-label="Search skills"
            placeholder="Find a skill…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
            {query.data?.standards
              .filter((rubric) =>
                rubric.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((rubric) => (
                <label
                  key={rubric.edition}
                  className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.includes(rubric.edition)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...selected, rubric.edition]
                          : selected.filter(
                              (value) => value !== rubric.edition,
                            ),
                      )
                    }
                  />
                  <span>{rubric.name}</span>
                </label>
              ))}
            {query.data?.standards.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No course skills yet.
              </p>
            )}
            {Boolean(query.data?.standards.length) &&
              !query.data?.standards.some((rubric) =>
                rubric.name.toLowerCase().includes(search.toLowerCase()),
              ) && (
                <p className="p-3 text-sm text-muted-foreground">
                  No matching skills.
                </p>
              )}
          </div>
        </>
      )}
    </section>
  );
}

interface PointDraft {
  key: string;
  criterion?: string;
  name: string;
  maxPoints: string;
}
interface CompetencyDraft {
  key: string;
  criterion?: string;
  basis: string;
  name: string;
}
interface SetupDraft {
  method: GradingMethod;
  points: PointDraft[];
  competencies: CompetencyDraft[];
}
function setupDraft(setup: GradingSetup): SetupDraft {
  const points = pointCriteria(setup.criteria).map((criterion) => ({
    key: criterion.criterion,
    criterion: criterion.criterion,
    name: criterion.name,
    maxPoints: String(criterion.maxPoints),
  }));
  return {
    method: setup.method,
    points:
      points.length || setup.method === "POINTS"
        ? points
        : [{ key: "default-overall", name: "Overall", maxPoints: "100" }],
    competencies: competencyCriteria(setup.criteria).map((criterion) => ({
      key: criterion.criterion,
      criterion: criterion.criterion,
      basis: criterion.basis,
      name: criterion.name,
    })),
  };
}

function setupPayload(draft: SetupDraft): SetupCriterionInput[] {
  return draft.method === "POINTS"
    ? draft.points.map((criterion, position) => ({
        kind: "POINTS",
        ...(criterion.criterion ? { criterion: criterion.criterion } : {}),
        name: criterion.name.trim(),
        maxPoints: Number(criterion.maxPoints),
        position,
      }))
    : draft.competencies.map((criterion, position) => ({
        kind: "COMPETENCY",
        ...(criterion.criterion ? { criterion: criterion.criterion } : {}),
        basis: criterion.basis,
        position,
      }));
}

function setupSignature(setup: GradingSetup) {
  return JSON.stringify(setupPayload(setupDraft(setup)));
}

function setupMatches(
  setup: GradingSetup,
  method: GradingMethod,
  intended: SetupCriterionInput[],
) {
  if (setup.method !== method) return false;
  const saved = setupPayload(setupDraft(setup));
  return (
    saved.length === intended.length &&
    saved.every((criterion, index) => {
      const expected = intended[index];
      if (!expected || criterion.kind !== expected.kind) return false;
      if (expected.criterion && criterion.criterion !== expected.criterion)
        return false;
      return criterion.kind === "POINTS" && expected.kind === "POINTS"
        ? criterion.position === expected.position &&
            criterion.name === expected.name &&
            criterion.maxPoints === expected.maxPoints
        : criterion.kind === "COMPETENCY" && expected.kind === "COMPETENCY"
          ? criterion.position === expected.position &&
            criterion.basis === expected.basis
          : false;
    })
  );
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination]!, next[index]!];
  return next;
}

function OrderActions({
  label,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Move ${label} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Move ${label} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={`Remove ${label}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

interface GradeSetupProps {
  item: string;
  title: string;
  published?: boolean;
  readOnly?: boolean;
  onMethodChange?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function GradeSetup(props: GradeSetupProps) {
  const { session } = useAuth();
  const query = useQuery(
    session
      ? async () =>
          unwrap(await api.grades.item({ item: props.item })) as GradingSetup
      : null,
    [session, props.item],
    { retainOnTransportError: true },
  );
  if (query.loading && !query.data)
    return <LoadingState label="Loading grading setup…" />;
  if (!query.data)
    return (
      <ErrorState
        message={query.error ?? "Could not load grading setup."}
        refused={query.refused}
        onRetry={query.refetch}
      />
    );
  return (
    <GradeSetupEditor
      key={props.item}
      {...props}
      initialSetup={query.data}
      query={query}
    />
  );
}

function GradeSetupEditor({
  item,
  readOnly = false,
  onMethodChange,
  onDirtyChange,
  initialSetup,
  query,
}: GradeSetupProps & {
  initialSetup: GradingSetup;
  query: QueryState<GradingSetup>;
}) {
  const { session } = useAuth();
  const standards = useQuery(
    session ? async () => unwrap(await api.grades.standards({})) : null,
    [session, item],
  );
  const [baseline, setBaseline] = useState(initialSetup);
  const [draft, setDraft] = useState(() => setupDraft(initialSetup));
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reloadReviewing, setReloadReviewing] = useState(false);
  const [uncertainIntent, setUncertainIntent] = useState<{
    method: GradingMethod;
    criteria: SetupCriterionInput[];
  } | null>(null);
  const nextKey = useRef(0);
  const payload = setupPayload(draft);
  const dirty =
    draft.method !== baseline.method ||
    JSON.stringify(payload) !== setupSignature(baseline);
  const pointTotal = sumDecimals(
    draft.points.map((criterion) => Number(criterion.maxPoints)),
  );
  const pointValid = Boolean(
    draft.points.length > 0 &&
      draft.points.every(
        (criterion) =>
          criterion.name.trim() &&
          criterion.maxPoints.trim() &&
          Number.isFinite(Number(criterion.maxPoints)) &&
          Number(criterion.maxPoints) > 0,
      ) &&
      Number.isFinite(pointTotal) &&
      (pointTotal ?? 0) > 0,
  );
  const valid =
    draft.method === "POINTS"
      ? pointValid
      : new Set(draft.competencies.map((criterion) => criterion.basis)).size ===
        draft.competencies.length;
  const unavailable = readOnly || busy || query.loading || Boolean(query.error);
  const savedSetupChanged = Boolean(
    query.data && query.data.revision !== baseline.revision,
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (
      !uncertainIntent ||
      !query.data ||
      !setupMatches(
        query.data,
        uncertainIntent.method,
        uncertainIntent.criteria,
      )
    )
      return;
    // This retry read is an external acknowledgement of the uncertain write.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBaseline(query.data);
    setDraft(setupDraft(query.data));
    setUncertainIntent(null);
    toast.success("Grading setup save confirmed");
  }, [query.data, uncertainIntent]);

  async function save() {
    if (!valid) return;
    setBusy(true);
    const reconcileUncertainSave = () => {
      setUncertainIntent({ method: draft.method, criteria: payload });
      toast.error(
        "The setup save could not be confirmed. Your draft remains here and saved assessments are unchanged; grading data is being refreshed before retrying.",
      );
      query.refetch();
      onMethodChange?.();
    };
    try {
      const result = await api.grades["configure-setup"]({
        item,
        method: draft.method,
        revision: baseline.revision,
        criteria: payload,
      });
      if ("error" in result) {
        if (isClientErrorCode(result.error)) {
          reconcileUncertainSave();
          return;
        }
        toast.error(
          result.error === "CONFLICT"
            ? "This grading setup changed. Your draft is still here; reload the saved setup before trying again."
            : result.error === "INVALID_REQUEST"
              ? "Check every criterion name, maximum, rubric, and position."
              : publicErrorMessage(result.error),
        );
        if (result.error === "CONFLICT") query.refetch();
        return;
      }
      setBaseline(result);
      setDraft(setupDraft(result));
      setBasis("");
      setUncertainIntent(null);
      toast.success("Grading setup saved");
      query.refetch();
      onMethodChange?.();
    } catch {
      reconcileUncertainSave();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-medium">Grading setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes apply only to assessments started after you save. Existing
          grades and correction history keep their original criteria and scores.
        </p>
      </div>
      <GradingDataNotice
        loading={query.loading}
        error={query.error}
        onRetry={query.refetch}
      />
      {(savedSetupChanged || uncertainIntent) &&
        !query.loading &&
        !query.error && (
          <div
            role="alert"
            className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {savedSetupChanged
                  ? "The saved setup changed elsewhere"
                  : "The setup save is not yet confirmed"}
              </p>
              <p className="mt-1 text-muted-foreground">
                Your draft still uses setup revision {baseline.revision}. Review
                the current saved setup before replacing your draft or retrying.
                Saved assessments are unchanged.
              </p>
            </div>
            <ConfirmAction
              open={reloadReviewing}
              onOpenChange={setReloadReviewing}
              title="Reload the saved grading setup?"
              description="This discards only your unsaved setup draft. Existing assessments, released grades, and correction history are unchanged."
              confirmLabel="Reload saved setup"
              onConfirm={() => {
                if (!query.data) return;
                setBaseline(query.data);
                setDraft(setupDraft(query.data));
                setBasis("");
                setUncertainIntent(null);
              }}
              trigger={
                <Button type="button" size="sm" variant="outline">
                  Review saved setup
                </Button>
              }
            />
          </div>
        )}
      <div className="flex flex-wrap gap-2" aria-label="Grading method">
        {(
          [
            ["COMPETENCY", "Competency"],
            ["POINTS", "Points"],
          ] as const
        ).map(([method, label]) => (
          <Button
            key={method}
            type="button"
            size="sm"
            variant={draft.method === method ? "default" : "outline"}
            aria-pressed={draft.method === method}
            disabled={unavailable}
            onClick={() =>
              setDraft((current) =>
                current ? { ...current, method } : current,
              )
            }
          >
            {label}
          </Button>
        ))}
      </div>

      {draft.method === "POINTS" ? (
        <div className="space-y-3">
          <div className="divide-y rounded-lg border border-border">
            {draft.points.map((criterion, index) => {
              const maximum = Number(criterion.maxPoints);
              const maximumValid =
                criterion.maxPoints.trim() !== "" &&
                Number.isFinite(maximum) &&
                maximum > 0;
              return (
                <div
                  key={criterion.key}
                  className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`${criterion.key}-name`}>Criterion</Label>
                    <Input
                      id={`${criterion.key}-name`}
                      value={criterion.name}
                      maxLength={200}
                      disabled={unavailable}
                      aria-invalid={!criterion.name.trim()}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                points: current.points.map((entry) =>
                                  entry.key === criterion.key
                                    ? { ...entry, name: event.target.value }
                                    : entry,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${criterion.key}-maximum`}>
                      Maximum points
                    </Label>
                    <Input
                      id={`${criterion.key}-maximum`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={criterion.maxPoints}
                      disabled={unavailable}
                      aria-invalid={!maximumValid}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                points: current.points.map((entry) =>
                                  entry.key === criterion.key
                                    ? {
                                        ...entry,
                                        maxPoints: event.target.value,
                                      }
                                    : entry,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                  <OrderActions
                    label={criterion.name || `criterion ${index + 1}`}
                    index={index}
                    count={draft.points.length}
                    disabled={unavailable}
                    onMove={(direction) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              points: move(current.points, index, direction),
                            }
                          : current,
                      )
                    }
                    onRemove={() =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              points: current.points.filter(
                                (entry) => entry.key !== criterion.key,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={unavailable}
              onClick={() => {
                const key = `new-point-${nextKey.current++}`;
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        points: [
                          ...current.points,
                          { key, name: "", maxPoints: "" },
                        ],
                      }
                    : current,
                );
              }}
            >
              <Plus className="size-4" /> Add criterion
            </Button>
            <p className="font-medium tabular-nums">
              Total: {pointValid ? pointTotal : "—"} points
            </p>
          </div>
          {!pointValid && (
            <p className="text-sm text-destructive">
              Add at least one named criterion with a maximum greater than zero.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="divide-y rounded-lg border border-border">
            {draft.competencies.map((criterion, index) => {
              const rubric = standards.data?.standards.find(
                (entry) => entry.edition === criterion.basis,
              );
              return (
                <div key={criterion.key} className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {rubric?.name ?? criterion.name}
                      </p>
                      {rubric ? (
                        <RubricDescription rubric={rubric} showEdition />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          The selected rubric edition remains fixed for this
                          setup.
                        </p>
                      )}
                    </div>
                    <OrderActions
                      label={rubric?.name ?? criterion.name}
                      index={index}
                      count={draft.competencies.length}
                      disabled={unavailable}
                      onMove={(direction) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                competencies: move(
                                  current.competencies,
                                  index,
                                  direction,
                                ),
                              }
                            : current,
                        )
                      }
                      onRemove={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                competencies: current.competencies.filter(
                                  (entry) => entry.key !== criterion.key,
                                ),
                              }
                            : current,
                        )
                      }
                    />
                  </div>
                </div>
              );
            })}
            {draft.competencies.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No skills selected. Add one before assessing submitted work.
              </p>
            )}
          </div>
          {standards.error ? (
            <ErrorState message={standards.error} onRetry={standards.refetch} />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={basis}
                disabled={unavailable || standards.loading}
                onValueChange={setBasis}
              >
                <SelectTrigger
                  aria-label="Add a skill"
                  className="min-w-0 flex-1"
                >
                  <SelectValue placeholder="Select a skill…" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const selectedStandards = new Set(
                      draft.competencies.map(
                        (criterion) =>
                          standards.data?.standards.find(
                            (rubric) => rubric.edition === criterion.basis,
                          )?.standard,
                      ),
                    );
                    const available = (standards.data?.standards ?? []).filter(
                      (rubric) => !selectedStandards.has(rubric.standard),
                    );
                    return available.length ? (
                      available.map((rubric) => (
                        <SelectItem key={rubric.edition} value={rubric.edition}>
                          {rubric.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectGroup>
                        <SelectLabel>
                          Every course skill is selected
                        </SelectLabel>
                      </SelectGroup>
                    );
                  })()}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={!basis || unavailable}
                onClick={() => {
                  const rubric = standards.data?.standards.find(
                    (entry) => entry.edition === basis,
                  );
                  if (!rubric) return;
                  const key = `new-competency-${nextKey.current++}`;
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          competencies: [
                            ...current.competencies,
                            { key, basis, name: rubric.name },
                          ],
                        }
                      : current,
                  );
                  setBasis("");
                }}
              >
                Add skill
              </Button>
            </div>
          )}
          <Link
            className="text-xs text-muted-foreground underline"
            href="/staff/skills"
          >
            Manage skills and rubrics
          </Link>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <ConfirmAction
            open={reviewing}
            onOpenChange={setReviewing}
            title="Apply this setup to future assessments?"
            description="New assessments will use this method and ordered criteria. Existing drafts, released grades, excusals, and correction history keep their saved setup and are not deleted or changed."
            confirmLabel="Save grading setup"
            confirmDisabled={unavailable || !valid || !dirty}
            onConfirm={save}
            trigger={
              <Button disabled={unavailable || !valid || !dirty}>
                Review and save
              </Button>
            }
          />
          <span className="text-xs text-muted-foreground">
            {dirty ? "Unsaved setup changes" : "Setup saved"}
          </span>
        </div>
      )}
    </section>
  );
}
