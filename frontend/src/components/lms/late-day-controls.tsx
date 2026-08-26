"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { count, fullTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface BalanceInfo {
  granted: number;
  used: number;
  remaining: number;
}

interface LateDayControlsProps {
  assignment: string;
  balance: BalanceInfo | null;
  appliedDays: number;
  dueAt: string;
  closeAt: string | null;
  unitHours: number;
  onUpdate: () => void;
  className?: string;
}

export function LateDayControls({
  assignment,
  balance,
  appliedDays,
  dueAt,
  closeAt,
  unitHours,
  onUpdate,
  className,
}: LateDayControlsProps) {
  const { session } = useAuth();
  const [days, setDays] = useState(appliedDays > 0 ? appliedDays : 1);
  const [loading, setLoading] = useState(false);
  const extend = (value: string, amount: number) =>
    new Date(new Date(value).getTime() + amount * unitHours * 3600000);
  const newDue = extend(dueAt, days);
  const newClose = closeAt ? extend(closeAt, days) : null;

  async function apply() {
    if (!session || days <= 0) return;
    setLoading(true);
    const result = await api["late-days"].apply({
      assignment,
      days,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`${count(days, "late day")} applied`);
      onUpdate();
    }
  }

  async function change() {
    if (!session || days <= 0) return;
    setLoading(true);
    const result = await api["late-days"].change({
      assignment,
      days,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`Changed to ${count(days, "late day")}`);
      onUpdate();
    }
  }

  async function cancel() {
    if (!session) return;
    setLoading(true);
    const result = await api["late-days"].cancel({ assignment });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Late days canceled");
      onUpdate();
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Late Days</p>
        {balance && (
          <p className="text-sm text-muted-foreground">
            Balance: {balance.remaining} remaining of {balance.granted}
          </p>
        )}
      </div>

      {appliedDays > 0 ? (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium">
              {count(appliedDays, "late day")}
            </span>{" "}
            applied to this assignment
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor={`late-days-${assignment}`} className="text-xs">
                Days to apply
              </Label>
              <Input
                id={`late-days-${assignment}`}
                type="number"
                min={1}
                max={balance ? balance.remaining + appliedDays : undefined}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-20"
                disabled={loading}
              />
            </div>
            <ConfirmAction
              title={`Change to ${count(days, "late day")}?`}
              description={`The effective due date will be ${fullTime(newDue)}${newClose ? ` and submissions will close ${fullTime(newClose)}` : ""}.`}
              confirmLabel="Change late days"
              onConfirm={change}
              trigger={
                <Button size="sm" variant="outline" disabled={loading}>
                  Change
                </Button>
              }
            />
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={cancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`late-days-${assignment}`} className="text-xs">
              Days to apply
            </Label>
            <Input
              id={`late-days-${assignment}`}
              type="number"
              min={1}
              max={balance?.remaining}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-20"
              disabled={loading}
            />
          </div>
          <ConfirmAction
            title={`Apply ${count(days, "late day")}?`}
            description={`This spends ${count(days, "late day")} and moves the effective due date to ${fullTime(newDue)}${newClose ? ` and the submission close to ${fullTime(newClose)}` : ""}.`}
            confirmLabel="Apply late days"
            onConfirm={apply}
            trigger={
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !balance || balance.remaining < days}
              >
                Apply Late Days
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
