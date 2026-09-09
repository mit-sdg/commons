"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, type Output, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RubricDescription } from "./assessment-history";

type Standard = Extract<
  Output<"/grades/standards">,
  { standards: unknown }
>["standards"][number];
const empty = {
  name: "",
  description: "",
  deficient: "",
  emergent: "",
  competent: "",
  expert: "",
  referenceUrl: "",
};
const fields = [
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
  const [editing, setEditing] = useState<Standard | null | undefined>(
    undefined,
  );
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.refetch} />;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rubrics</h2>
          <p className="text-sm text-muted-foreground">
            Shared expectations for the skills assessed in your course.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing(null)}>
          Define rubric
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
        <LoadingState label="Loading rubrics..." />
      ) : query.data?.standards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Define a rubric with descriptions for all four levels, then select it
          on an assignment.
        </p>
      ) : (
        query.data?.standards.map((r) => (
          <div
            key={r.standard}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h3 className="font-medium">{r.name}</h3>
              <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                Issue revised edition
              </Button>
            </div>
            <RubricDescription rubric={r} />
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
          fields.map(([k]) => [k, existing[k]]),
        ) as typeof empty)
      : empty,
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
              ? "Supply all rubric descriptions and a safe HTTP or HTTPS reference link."
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
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className="font-medium">
        {existing ? `Revise ${existing.name}` : "Define rubric"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {existing
          ? "This creates a new edition. Existing assignments and assessments keep the edition they selected."
          : "Describe observable performance at each level. These descriptions will appear beside student assessments."}
      </p>
      {fields.map(([key, label]) => (
        <div className="space-y-2" key={key}>
          <Label htmlFor={`standard-${key}`}>{label}</Label>
          {key === "name" || key === "referenceUrl" ? (
            <Input
              id={`standard-${key}`}
              type={key === "referenceUrl" ? "url" : "text"}
              maxLength={key === "referenceUrl" ? 2048 : 10000}
              required={key !== "referenceUrl"}
              value={values[key]}
              disabled={busy}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          ) : (
            <Textarea
              id={`standard-${key}`}
              required
              maxLength={10000}
              value={values[key]}
              disabled={busy}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          )}
        </div>
      ))}
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
export function GradeSetup({ item }: { item: string }) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.grades.item({ item })) : null,
    [session, item],
  );
  const standards = useQuery(
    session ? async () => unwrap(await api.grades.standards({})) : null,
    [session, item],
  );
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (!basis) return;
    setBusy(true);
    try {
      const r = await api.grades["add-criterion"]({
        item,
        basis,
        position: query.data?.criteria.length ?? 0,
      });
      if ("error" in r) toast.error(publicErrorMessage(r.error));
      else {
        query.refetch();
        setBasis("");
      }
    } finally {
      setBusy(false);
    }
  }
  async function remove(criterion: string) {
    setBusy(true);
    try {
      const r = await api.grades["remove-criterion"]({ criterion });
      if ("error" in r) toast.error(publicErrorMessage(r.error));
      else query.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (query.loading && !query.data)
    return <LoadingState label="Loading assessment setup..." />;
  if (query.error)
    return (
      <p className="text-sm text-muted-foreground">
        Publish an assignment that accepts submissions to configure its
        assessment criteria.
      </p>
    );
  const selected = query.data?.criteria ?? [];
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Select the skills assessed by this assignment. Each new assessment keeps
        the rubric editions selected when it starts.
      </p>
      {selected.map((c) => (
        <div
          key={c.criterion}
          className="space-y-2 rounded-md border border-border p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-medium">{c.name}</h3>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => remove(c.criterion)}
            >
              Remove from future assessments
            </Button>
          </div>
          <RubricDescription rubric={c} />
        </div>
      ))}
      {selected.length === 0 && (
        <p className="text-sm">No skills selected yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Label htmlFor={`rubric-select-${item}`} className="sr-only">
          Select a rubric
        </Label>
        <select
          id={`rubric-select-${item}`}
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={basis}
          disabled={busy}
          onChange={(e) => setBasis(e.target.value)}
        >
          <option value="">Select a rubric…</option>
          {standards.data?.standards
            .filter((r) => !selected.some((c) => c.standard === r.standard))
            .map((r) => (
              <option key={r.edition} value={r.edition}>
                {r.name} · edition {r.number}
              </option>
            ))}
        </select>
        <Button disabled={!basis || busy} onClick={add}>
          Add skill
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        To adopt a revised edition, remove the old selection and add the new
        one. Existing assessments retain their original criteria.
      </p>
      <details className="border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Manage course rubrics
        </summary>
        <div className="mt-4">
          <StandardManager onChanged={standards.refetch} />
        </div>
      </details>
    </div>
  );
}
