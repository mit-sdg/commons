"use client";

import { Clock, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import type { Output } from "@/lib/api";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count } from "@/lib/format";
import { loadStaffAssignments, loadStaffDashboard } from "@/lib/lms";

function PolicySettings({
  policy,
  onUpdate,
}: {
  policy: Output<"/late-days/policy">;
  onUpdate: () => void;
}) {
  const [defaultDays, setDefaultDays] = useState(policy.defaultDays);
  const [maxDaysPerItem, setMaxDaysPerItem] = useState(policy.maxDaysPerItem);
  const [unitHours, setUnitHours] = useState(policy.unitHours);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await api["late-days"]["configure-policy"]({
      defaultDays,
      maxDaysPerItem,
      unitHours,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Late-day policy saved");
      onUpdate();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="size-4" /> Policy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="policy-default-days">Default allowance</Label>
            <Input
              id="policy-default-days"
              type="number"
              min={0}
              value={defaultDays}
              onChange={(event) => setDefaultDays(Number(event.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="policy-max-days">Maximum per assignment</Label>
            <Input
              id="policy-max-days"
              type="number"
              min={0}
              value={maxDaysPerItem}
              onChange={(event) =>
                setMaxDaysPerItem(Number(event.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="policy-unit-hours">Hours per late day</Label>
            <Input
              id="policy-unit-hours"
              type="number"
              min={1}
              value={unitHours}
              onChange={(event) => setUnitHours(Number(event.target.value))}
            />
          </div>
          <Button
            onClick={save}
            disabled={
              busy || defaultDays < 0 || maxDaysPerItem < 0 || unitHours < 1
            }
          >
            {busy ? "Saving…" : "Save policy"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LateUseRow({
  use,
  learnerName,
  assignmentTitle,
  maxDays,
  onUpdate,
}: {
  use: { learner: string; assignment: string; days: number };
  learnerName: string;
  assignmentTitle: string;
  maxDays: number;
  onUpdate: () => void;
}) {
  const [days, setDays] = useState(use.days);
  const [busy, setBusy] = useState(false);

  async function change() {
    setBusy(true);
    const result = await api["late-days"]["staff-change"]({
      learner: use.learner,
      assignment: use.assignment,
      days,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Late-day use updated");
      onUpdate();
    }
  }

  async function cancel() {
    const result = await api["late-days"]["staff-cancel"]({
      learner: use.learner,
      assignment: use.assignment,
    });
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Late-day use canceled");
      onUpdate();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-medium">{learnerName}</p>
        <p className="text-sm text-muted-foreground">{assignmentTitle}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label
            htmlFor={`staff-late-days-${use.learner}-${use.assignment}`}
            className="text-xs"
          >
            Days
          </Label>
          <Input
            id={`staff-late-days-${use.learner}-${use.assignment}`}
            type="number"
            min={0}
            max={maxDays}
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="w-20"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={change}
          disabled={busy || days < 0 || days > maxDays || days === use.days}
        >
          Update
        </Button>
        <ConfirmAction
          title="Cancel this late-day use?"
          description={`${use.days} ${use.days === 1 ? "day" : "days"} will return to ${learnerName}'s balance.`}
          confirmLabel="Cancel use"
          destructive
          onConfirm={cancel}
          trigger={
            <Button size="sm" variant="ghost" className="text-destructive">
              Cancel use
            </Button>
          }
        />
      </div>
    </div>
  );
}

function LateDaysAdminPageContent() {
  const { session } = useAuth();

  const { data: rosterData } = useQuery(
    session ? () => loadStaffDashboard() : null,
    [session],
  );
  const assignmentsQuery = useQuery(
    session ? () => loadStaffAssignments() : null,
    [session],
  );
  const policyQuery = useQuery(
    session ? () => api["late-days"].policy({}).then(unwrap) : null,
    [session],
  );

  const [grantDialog, setGrantDialog] = useState<{
    learner: string;
    name: string;
  } | null>(null);
  const [grantDays, setGrantDays] = useState(1);
  const [grantReason, setGrantReason] = useState("");
  const [grantLoading, setGrantLoading] = useState(false);

  const students = (rosterData?.dashboard ?? []).filter(
    (member): member is typeof member & { user: string } =>
      member.kind === "STUDENT" && member.user !== null,
  );
  const assignments = assignmentsQuery.data?.assignments ?? [];

  const usesQuery = useQuery<
    { learner: string; assignment: string; days: number }[]
  >(
    assignments.length > 0
      ? async () => {
          const lists = await Promise.all(
            assignments.map(async (assignment) => {
              const result = await api["late-days"]["for-assignment"]({
                assignment: String(assignment.assignment),
              });
              if ("error" in result) return [];
              return result.users.map((use) => ({
                learner: String(use.learner),
                assignment: String(assignment.assignment),
                days: use.days,
              }));
            }),
          );
          return lists.flat();
        }
      : null,
    [assignmentsQuery.data],
  );

  const { data: balances, refetch: refetchBalances } = useQuery<
    Record<string, { granted: number; used: number; remaining: number }>
  >(
    rosterData?.dashboard
      ? async () => {
          const map: Record<
            string,
            { granted: number; used: number; remaining: number }
          > = {};
          await Promise.all(
            students.map(async (student) => {
              const result = await api["late-days"].balance({
                learner: student.user,
              });
              map[student.user] = unwrap(result).balance;
            }),
          );
          return map;
        }
      : null,
    [rosterData, session],
  );

  function refetchLateDays() {
    usesQuery.refetch();
    refetchBalances();
  }

  async function doGrant() {
    if (!session || !grantDialog) return;
    setGrantLoading(true);
    const result = await api["late-days"].grant({
      learner: grantDialog.learner,
      days: grantDays,
      reason: grantReason,
    });
    setGrantLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(
        `Granted ${count(grantDays, "late day")} to ${grantDialog.name}`,
      );
      setGrantDialog(null);
      setGrantReason("");
      setGrantDays(1);
      refetchBalances();
    }
  }

  const learnerNames = new Map(
    students.map((student) => [student.user, student.displayName]),
  );
  const assignmentTitles = new Map(
    assignments.map((assignment) => [
      String(assignment.assignment),
      assignment.title,
    ]),
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Course staff"
        title="Late days"
        description="Configure the policy, review active uses, and adjust learner balances."
      />

      <div className="space-y-6">
        {policyQuery.loading ? (
          <LoadingState label="Loading late-day policy…" />
        ) : policyQuery.error ? (
          <ErrorState
            message={policyQuery.error}
            onRetry={policyQuery.refetch}
          />
        ) : policyQuery.data ? (
          <PolicySettings
            key={`${policyQuery.data.defaultDays}-${policyQuery.data.maxDaysPerItem}-${policyQuery.data.unitHours}`}
            policy={policyQuery.data}
            onUpdate={() => {
              policyQuery.refetch();
              refetchBalances();
              usesQuery.refetch();
            }}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active assignment uses</CardTitle>
          </CardHeader>
          <CardContent>
            {usesQuery.loading ? (
              <LoadingState label="Loading active uses…" />
            ) : usesQuery.error ? (
              <ErrorState
                message={usesQuery.error}
                onRetry={usesQuery.refetch}
              />
            ) : !usesQuery.data || usesQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No learners currently have late days applied.
              </p>
            ) : (
              <div className="space-y-2">
                {usesQuery.data.map((use) => (
                  <LateUseRow
                    key={`${use.learner}-${use.assignment}`}
                    use={use}
                    learnerName={learnerNames.get(use.learner) ?? "Learner"}
                    assignmentTitle={
                      assignmentTitles.get(use.assignment) ?? "Assignment"
                    }
                    maxDays={policyQuery.data?.maxDaysPerItem ?? 5}
                    onUpdate={refetchLateDays}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learner balances</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No learners"
                description="Active learners appear here after joining the course."
              />
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const balance = balances?.[student.user];
                  return (
                    <div
                      key={student.user}
                      className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {student.displayName ?? student.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.email}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        {balance ? (
                          <dl className="flex gap-3 text-sm">
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                Remaining
                              </dt>
                              <dd className="font-semibold">
                                {balance.remaining}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                Used
                              </dt>
                              <dd className="font-semibold">{balance.used}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted-foreground">
                                Granted
                              </dt>
                              <dd className="font-semibold">
                                {balance.granted}
                              </dd>
                            </div>
                          </dl>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Loading…
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setGrantDialog({
                              learner: student.user,
                              name: student.displayName ?? student.email,
                            })
                          }
                        >
                          <Plus className="size-4" /> Grant days
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!grantDialog}
        onOpenChange={(open) => !open && setGrantDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant late days</DialogTitle>
            <DialogDescription>
              Add late days to {grantDialog?.name}&apos;s balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grant-days">Days</Label>
              <Input
                id="grant-days"
                type="number"
                min={1}
                value={grantDays}
                onChange={(event) => setGrantDays(Number(event.target.value))}
                disabled={grantLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grant-reason">Reason</Label>
              <Textarea
                id="grant-reason"
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                placeholder="e.g. Extension for illness…"
                rows={3}
                disabled={grantLoading}
              />
            </div>
            <Button
              onClick={doGrant}
              disabled={grantLoading || grantDays < 1 || !grantReason.trim()}
            >
              Grant {count(grantDays, "late day")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

export default function LateDaysAdminPage() {
  return (
    <RequireCapability capability="student-records">
      <LateDaysAdminPageContent />
    </RequireCapability>
  );
}
