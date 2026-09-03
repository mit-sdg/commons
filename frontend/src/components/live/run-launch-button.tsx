"use client";

import { Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, isApiError, publicErrorMessage } from "@/lib/api";

/**
 * One request both opens the run and issues its token, so the host walks away
 * holding everything the room needs. This button carries them straight to the
 * dashboard that shows it.
 *
 * A refusal here is a backstop: callers disable the button when they can see
 * the questionnaire is not ready, so a refusal means the facts moved after the
 * page last read them. The wire folds both refusals — a run already open, a
 * quiz not ready — into one conflict, so the toast cannot name which.
 */
export function RunLaunchButton({
  questionnaire,
  disabled = false,
  hint,
  label = "Launch",
  size = "default",
  variant = "default",
}: {
  questionnaire: string;
  disabled?: boolean;
  /** Why the button is out: said on hover and read out with the button. */
  hint?: string;
  label?: string;
  /** Passed straight through, so the button looks like any other Button. */
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const hintId = useId();
  const said = disabled && hint !== undefined;

  async function launch() {
    setBusy(true);
    const result = await api["/live/runs/launch"]({ questionnaire });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(
        result.error === "CONFLICT"
          ? "This cannot launch right now."
          : publicErrorMessage(result.error),
      );
      return;
    }
    // The dashboard takes over from here; this page is on its way out.
    router.push(`/staff/live/run/${result.run}`);
  }

  // Out, the button keeps its focus and its words: it is out by aria, so the
  // reason is on hover and under the cursor of a screen reader alike.
  return (
    <span className="inline-flex">
      <Button
        size={size}
        variant={disabled ? "outline" : variant}
        className={
          disabled
            ? "cursor-default text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30"
            : undefined
        }
        aria-disabled={disabled || undefined}
        disabled={busy}
        title={disabled ? hint : undefined}
        aria-describedby={said ? hintId : undefined}
        onClick={() => {
          if (disabled) return;
          void launch();
        }}
      >
        <Radio /> {busy ? "Launching…" : label}
      </Button>
      {said ? (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      ) : null}
    </span>
  );
}
