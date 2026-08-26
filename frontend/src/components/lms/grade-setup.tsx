"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@/hooks/use-query";
import type { Output } from "@/lib/api";
import { api, publicErrorMessage } from "@/lib/api";

export function GradeSetup({ item }: { item: string }) {
  const query = useQuery(() => api.grades.item({ item }), [item]);

  if (query.loading && !query.data) {
    return (
      <Card>
        <CardContent>
          <LoadingState label="Loading grade settings…" />
        </CardContent>
      </Card>
    );
  }

  if (!query.data || "error" in query.data) return null;

  return (
    <GradeSetupForm
      key={`${query.data.label}-${query.data.maxPoints}-${query.data.criteria.length}`}
      item={item}
      detail={query.data}
      onUpdate={query.refetch}
    />
  );
}

function GradeSetupForm({
  item,
  detail,
  onUpdate,
}: {
  item: string;
  detail: Output<"/grades/item">;
  onUpdate: () => void;
}) {
  const [label, setLabel] = useState(detail.label);
  const [maxPoints, setMaxPoints] = useState(detail.maxPoints);
  const [criterionName, setCriterionName] = useState("");
  const [criterionPoints, setCriterionPoints] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPoints, setEditPoints] = useState(0);
  const [busy, setBusy] = useState(false);
  const criteriaMaximum = detail.criteria.reduce(
    (total, criterion) => total + criterion.maxPoints,
    0,
  );

  async function configure() {
    setBusy(true);
    const result = await api.grades["configure-item"]({
      item,
      label: label.trim(),
      maxPoints,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Grade settings saved");
      onUpdate();
    }
  }

  async function addCriterion() {
    if (!criterionName.trim()) return;
    setBusy(true);
    const result = await api.grades["add-criterion"]({
      item,
      name: criterionName.trim(),
      maxPoints: criterionPoints,
      position: detail.criteria.length + 1,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Criterion added");
      setCriterionName("");
      setCriterionPoints(0);
      onUpdate();
    }
  }

  async function reviseCriterion(criterion: string, position: number) {
    if (!editName.trim()) return;
    setBusy(true);
    const result = await api.grades["revise-criterion"]({
      criterion,
      name: editName.trim(),
      maxPoints: editPoints,
      position,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Criterion updated");
      setEditing(null);
      onUpdate();
    }
  }

  async function removeCriterion(criterion: string) {
    const result = await api.grades["remove-criterion"]({ criterion });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Criterion removed");
      onUpdate();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grade settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`grade-label-${item}`}>Gradebook label</Label>
            <Input
              id={`grade-label-${item}`}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`grade-max-${item}`}>Maximum points</Label>
            <Input
              id={`grade-max-${item}`}
              type="number"
              min={0}
              value={maxPoints}
              onChange={(event) => setMaxPoints(Number(event.target.value))}
            />
          </div>
          <Button onClick={configure} disabled={busy || !label.trim()}>
            Save settings
          </Button>
        </div>

        {detail.criteria.length > 0 && criteriaMaximum !== maxPoints ? (
          <p className="rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            Rubric criteria total {criteriaMaximum} points, which differs from
            the {maxPoints}-point overall grade.
          </p>
        ) : null}

        <div className="border-t border-border pt-5">
          <div className="mb-3">
            <h3 className="font-display font-semibold">Rubric criteria</h3>
            <p className="text-sm text-muted-foreground">
              Optional criteria describe how the assignment is assessed.
            </p>
          </div>
          {detail.criteria.length > 0 ? (
            <div className="mb-4 space-y-2">
              {detail.criteria.map((criterion) =>
                editing === String(criterion.criterion) ? (
                  <div
                    key={String(criterion.criterion)}
                    className="grid gap-2 rounded-lg border border-primary/30 bg-muted/25 p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`criterion-name-${criterion.criterion}`}>
                        Name
                      </Label>
                      <Input
                        id={`criterion-name-${criterion.criterion}`}
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor={`criterion-points-${criterion.criterion}`}
                      >
                        Points
                      </Label>
                      <Input
                        id={`criterion-points-${criterion.criterion}`}
                        type="number"
                        min={0}
                        value={editPoints}
                        onChange={(event) =>
                          setEditPoints(Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          reviseCriterion(
                            String(criterion.criterion),
                            criterion.position,
                          )
                        }
                        disabled={busy || !editName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={String(criterion.criterion)}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{criterion.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {criterion.maxPoints} points · Position{" "}
                        {criterion.position}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(String(criterion.criterion));
                          setEditName(criterion.name);
                          setEditPoints(criterion.maxPoints);
                        }}
                      >
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <ConfirmAction
                        title={`Remove ${criterion.name}?`}
                        description="Existing criterion scores for this criterion will also be cleared."
                        confirmLabel="Remove criterion"
                        destructive
                        onConfirm={() =>
                          removeCriterion(String(criterion.criterion))
                        }
                        trigger={
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            aria-label={`Remove ${criterion.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              No rubric criteria yet.
            </p>
          )}

          <div className="grid gap-2 rounded-lg border border-dashed border-border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`new-criterion-name-${item}`}>
                New criterion
              </Label>
              <Input
                id={`new-criterion-name-${item}`}
                value={criterionName}
                onChange={(event) => setCriterionName(event.target.value)}
                placeholder="e.g. Analysis"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`new-criterion-points-${item}`}>Points</Label>
              <Input
                id={`new-criterion-points-${item}`}
                type="number"
                min={0}
                value={criterionPoints}
                onChange={(event) =>
                  setCriterionPoints(Number(event.target.value))
                }
              />
            </div>
            <Button
              variant="outline"
              onClick={addCriterion}
              disabled={busy || !criterionName.trim()}
            >
              <Plus className="size-4" /> Add criterion
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
