"use client";
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
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
          <h2 className="text-lg font-semibold">Course skills</h2>
        </div>
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
        <LoadingState label="Loading rubrics..." />
      ) : query.data?.standards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add a skill, optionally link to its rubric, then select it on an
          assignment.
        </p>
      ) : (
        query.data?.standards.map((r) => (
          <div
            key={r.standard}
            className="space-y-2 rounded-lg border border-border p-4"
          >
            <RubricDescription
              rubric={r}
              title={r.name}
              action={
                <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
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
      onSubmit={(e) => {
        e.preventDefault();
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
        const inputs = fields
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
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                  }
                />
              ) : (
                <Textarea
                  id={`standard-${key}`}
                  maxLength={10000}
                  value={values[key]}
                  disabled={busy}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value }))
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
          // A refresh must not silently replace a selected rubric edition.
          const pinned = known.current.filter((r) =>
            selected.includes(r.edition),
          );
          known.current = [
            ...pinned,
            ...result.standards.filter(
              (r) => !pinned.some((p) => p.standard === r.standard),
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
    // The rubric manager opens in another tab; keep this draft's choices intact.
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
          Manage skills & rubrics
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
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto divide-y rounded-lg border">
            {query.data?.standards
              .filter((r) =>
                r.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((r) => (
                <label
                  key={r.edition}
                  className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.includes(r.edition)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...selected, r.edition]
                          : selected.filter((v) => v !== r.edition),
                      )
                    }
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            {query.data?.standards.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No course skills yet.
              </p>
            )}
            {Boolean(query.data?.standards.length) &&
              !query.data?.standards.some((r) =>
                r.name.toLowerCase().includes(search.toLowerCase()),
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

export function GradeSetup({
  item,
  title,
  published = false,
  readOnly = false,
}: {
  item: string;
  title: string;
  published?: boolean;
  readOnly?: boolean;
}) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.grades.item({ item })) : null,
    [session, item],
  );
  const standards = useQuery(
    session ? async () => unwrap(await api.grades.standards({})) : null,
    [session, item],
  );
  const [editing, setEditing] = useState(false);
  const [basis, setBasis] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    type: "add" | "remove";
    value: string;
  } | null>(null);
  async function change(action: { type: "add" | "remove"; value: string }) {
    setBusy(true);
    try {
      const r =
        action.type === "add"
          ? await api.grades["add-criterion"]({
              item,
              basis: action.value,
              position:
                Math.max(
                  -1,
                  ...(query.data?.criteria ?? []).map((c) => c.position),
                ) + 1,
            })
          : await api.grades["remove-criterion"]({ criterion: action.value });
      if ("error" in r) {
        toast.error(publicErrorMessage(r.error));
        return;
      }
      await query.refetch();
      setBasis("");
    } catch {
      toast.error("Could not update skills. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function request(action: { type: "add" | "remove"; value: string }) {
    if (published) setPending(action);
    else void change(action);
  }
  async function prepare() {
    setBusy(true);
    try {
      const r = await api.grades["configure-item"]({ item, label: title });
      if ("error" in r) toast.error(publicErrorMessage(r.error));
      else {
        await query.refetch();
        setEditing(true);
      }
    } catch {
      toast.error("Could not prepare assessment setup.");
    } finally {
      setBusy(false);
    }
  }
  if (query.loading && !query.data)
    return <LoadingState label="Loading skills…" />;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-medium">Skills assessed</h2>
        {!readOnly && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Done" : "Edit skills"}
          </Button>
        )}
      </div>
      {query.error ? (
        <div className="space-y-2">
          <ErrorState message={query.error} onRetry={query.refetch} />
          {!readOnly && !published && (
            <Button variant="outline" disabled={busy} onClick={prepare}>
              Set up skills
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="divide-y rounded-lg border">
            {(query.data?.criteria ?? []).map((c) => (
              <div key={c.criterion} className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{c.name}</span>
                  {editing && !readOnly && (
                    <Button
                      aria-label={`Remove ${c.name}`}
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        request({ type: "remove", value: c.criterion })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <RubricDescription rubric={c} showEdition={false} />
                {standards.data?.standards.some(
                  (r) => r.standard === c.standard && r.edition !== c.basis,
                ) && (
                  <p className="text-xs text-muted-foreground">
                    A newer rubric is available in{" "}
                    <Link className="underline" href="/staff/skills">
                      Skills & rubrics
                    </Link>
                    .
                    {editing
                      ? " Remove this selection and add the skill again to adopt it for future assessments."
                      : ""}
                  </p>
                )}
              </div>
            ))}
            {query.data?.criteria.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                No skills selected.
              </p>
            )}
          </div>
          {editing && !readOnly && (
            <div className="space-y-3">
              {standards.error ? (
                <ErrorState
                  message={standards.error}
                  onRetry={standards.refetch}
                />
              ) : (
                <div className="flex gap-2">
                  <Select
                    value={basis}
                    disabled={busy || standards.loading}
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
                        const available = (
                          standards.data?.standards ?? []
                        ).filter(
                          (r) =>
                            !query.data?.criteria.some(
                              (c) => c.standard === r.standard,
                            ),
                        );
                        return available.length === 0 ? (
                          <SelectLabel>
                            Every course skill is selected
                          </SelectLabel>
                        ) : (
                          available.map((r) => (
                            <SelectItem key={r.edition} value={r.edition}>
                              {r.name}
                            </SelectItem>
                          ))
                        );
                      })()}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!basis || busy}
                    onClick={() => request({ type: "add", value: basis })}
                  >
                    Add skill
                  </Button>
                </div>
              )}
              <Link
                className="text-xs text-muted-foreground underline"
                href="/staff/skills"
              >
                Manage skills & rubrics
              </Link>
            </div>
          )}
        </>
      )}
      <ConfirmAction
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        title="Change skills on a published assignment?"
        description="Students may already be working toward these expectations. Existing assessments keep their original skills and rubric editions. Assessments started after this change use the updated selection, including for work already submitted."
        confirmLabel="Change skills"
        onConfirm={async () => {
          if (pending) await change(pending);
        }}
      />
    </section>
  );
}
