"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RELAY_HELP } from "@/components/live/relay-help";
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
}: {
  guide: Record<string, string | null>;
  title?: string;
}) {
  const purpose = guide.purpose?.trim();
  const entries = Object.entries(guide).filter(
    ([field, body]) => field !== "purpose" && body?.trim(),
  );
  if (entries.length === 0 && !purpose) return null;
  return (
    <div className="min-w-0 space-y-3">
      {purpose ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {purpose}
        </p>
      ) : null}
      {entries.length > 0 ? (
        <details className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {title}
          </summary>
          <dl className="mt-3 space-y-3">
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
        </details>
      ) : null}
    </div>
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
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium">
      {label}
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
    </label>
  );
}

export function RelayGuideEditor({
  relay,
  onChanged,
}: {
  relay: Relay;
  onChanged: () => void;
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
      {relay.description ? (
        <p className="max-w-prose whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
          {relay.description}
        </p>
      ) : null}
      <details className="min-w-0 rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-medium text-sm">
          Description and host guide
        </summary>
        <div className="mt-4 space-y-3">
          {(["description", "opening", "closing"] as const).map((field) => (
            <GuideField
              key={field}
              label={GUIDE_LABELS[field] ?? field}
              body={
                field === "description"
                  ? relay.description
                  : relay.hostGuide[field]
              }
              disabled={relay.retired}
              save={(body) => save(field, body)}
            />
          ))}
        </div>
      </details>
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
    <div className="min-w-0 space-y-3">
      {round.hostGuide.purpose ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {round.hostGuide.purpose}
        </p>
      ) : null}
      <details className="min-w-0 rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Round host guide
        </summary>
        <div className="mt-3 space-y-3">
          {(["purpose", "facilitation", "selection"] as const).map((field) => (
            <GuideField
              key={field}
              label={`Round ${round.number} ${GUIDE_LABELS[field]?.toLowerCase() ?? field}`}
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
              Selection guidance is saved but inactive: no later round takes
              from this round.
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
}

export function RelayBasics() {
  return (
    <details className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Running a relay
      </summary>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
        {RELAY_HELP.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </details>
  );
}
