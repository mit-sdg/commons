"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { GuidancePanel } from "@/components/live/guidance-panel";
import { RelayWalkthrough } from "@/components/live/relay-walkthrough";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, isApiError, type Output, publicErrorMessage } from "@/lib/api";

type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;
type Round = Relay["rounds"][number];

export const GUIDE_LABELS: Record<string, string> = {
  description: "Description",
  opening: "Opening",
  closing: "Closing",
  purpose: "Purpose",
  facilitation: "Running this round",
  selection: "Choosing what continues",
};

export function GuideText({
  guide,
  title = "Session host guide",
  detail,
}: {
  guide: Record<string, string | null>;
  title?: string;
  detail?: string;
}) {
  const entries = Object.entries(guide).filter(([, body]) => body?.trim());
  if (!entries.length) return null;
  return (
    <GuidancePanel
      audience="host"
      scope={title}
      label={
        detail === "Round" || /round/i.test(title)
          ? "Round guide"
          : "Relay guide"
      }
    >
      <dl className="space-y-4">
        {entries.map(([field, body]) => (
          <div key={field}>
            <dt className="text-xs font-medium text-muted-foreground">
              {GUIDE_LABELS[field] ?? field}
            </dt>
            <dd
              className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]"
              dir="auto"
            >
              {body}
            </dd>
          </div>
        ))}
      </dl>
    </GuidancePanel>
  );
}

function GuideField({
  label,
  body,
  disabled,
  save,
}: {
  label: string;
  body: string;
  disabled: boolean;
  save: (body: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!editing)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
          {disabled ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              aria-label={`Edit ${label.toLowerCase()}`}
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>
        <p
          className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]"
          dir="auto"
        >
          {body || "No note added."}
        </p>
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Done
        </Button>
      </div>
      <Textarea
        key={body}
        defaultValue={body}
        aria-label={label}
        disabled={disabled}
        readOnly={busy}
        rows={2}
        className="min-h-16 font-normal"
        onBlur={(event) => {
          const next = event.target.value.trim();
          if (next === body || busy) return;
          setBusy(true);
          void save(next).finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

export function RelayGuideEditor({
  relay,
  onChanged,
  tools,
}: {
  relay: Relay;
  onChanged: () => void;
  tools?: ReactNode;
}) {
  async function save(
    field: "description" | "opening" | "closing",
    body: string,
  ) {
    const result = await api["/live/relays/set-guide"]({
      relay: relay.relay,
      field,
      body,
    });
    if (isApiError(result)) toast.error(publicErrorMessage(result.error));
    else onChanged();
  }
  return (
    <div className="min-w-0 space-y-3">
      <GuideField
        label="Overview"
        body={relay.description}
        disabled={relay.retired}
        save={(body) => save("description", body)}
      />
      <div className="flex flex-wrap items-center gap-1">
        {tools}
        <GuidancePanel audience="host" label="Relay guide" scope="Whole relay">
          {(["opening", "closing"] as const).map((field) => (
            <GuideField
              key={field}
              label={GUIDE_LABELS[field] ?? field}
              body={relay.hostGuide[field]}
              disabled={relay.retired}
              save={(body) => save(field, body)}
            />
          ))}
        </GuidancePanel>
        <RelayBasics />
      </div>
    </div>
  );
}

export function RoundGuideEditor({
  round,
  retired,
  onChanged,
}: {
  round: Round;
  retired: boolean;
  onChanged: () => void;
}) {
  async function save(
    field: "purpose" | "facilitation" | "selection",
    body: string,
  ) {
    const result = await api["/live/rounds/set-guide"]({
      leg: round.leg,
      field,
      body,
    });
    if (isApiError(result)) toast.error(publicErrorMessage(result.error));
    else onChanged();
  }
  return (
    <GuidancePanel
      audience="host"
      label="Round guide"
      scope={`Round ${round.number} — ${round.title}`}
    >
      {(["purpose", "facilitation", "selection"] as const).map((field) => (
        <GuideField
          key={field}
          label={GUIDE_LABELS[field] ?? field}
          body={
            field === "selection"
              ? round.storedSelection
              : round.hostGuide[field]
          }
          disabled={retired}
          save={(body) => save(field, body)}
        />
      ))}
      {round.hostGuide.selection === null && round.storedSelection ? (
        <p className="text-muted-foreground text-xs">
          Selection guidance is saved but inactive: no later round takes from
          this round.
        </p>
      ) : null}
    </GuidancePanel>
  );
}

export function RelayBasics() {
  return (
    <GuidancePanel audience="help" scope="Running a relay">
      <RelayWalkthrough />
    </GuidancePanel>
  );
}
