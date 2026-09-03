"use client";

import { ArrowLeft, ChevronRight, Layers, Radio } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import { FormBadge, RETIRE_NOTE } from "@/components/live/quiz-meta";
import {
  RoundToken,
  TakesChip,
  takeWords,
} from "@/components/live/round-token";
import { kindOf, NO_ROUNDS, type RelayRound } from "@/components/live/rounds";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  isApiError,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fullTime } from "@/lib/format";

type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;

function RelayOverviewContent() {
  const { relay } = useParams<{ relay: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useQuery(
    session ? () => api["/live/relays/get"]({ relay }).then(unwrap) : null,
    [session, relay],
  );

  if (loading && data === null) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );
  }

  const found: Relay | null = data?.relay ?? null;
  if (found === null) {
    return (
      <PageContainer>
        <EmptyState
          icon={Layers}
          title="No such relay"
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live">Back to Live</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const openRun = found.runs.find((run) => run.open) ?? null;

  async function launch() {
    setBusy(true);
    const result = await api["/live/relays/launch"]({ relay });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/run/${result.run}`);
  }

  async function retire() {
    const result = await api["/live/relays/retire"]({ relay });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    refetch();
  }

  return (
    <PageContainer>
      <PageHeader
        className="max-w-4xl"
        eyebrow={
          <Link
            href="/staff/live"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {found.title}
            <FormBadge form="relay" />
            {found.retired ? <Badge variant="outline">Retired</Badge> : null}
          </span>
        }
        actions={
          <>
            {found.retired ? null : (
              <Button variant="outline" asChild>
                <Link href={`/staff/live/relay/${found.relay}/edit`}>Edit</Link>
              </Button>
            )}
            {openRun !== null ? (
              <Button asChild>
                <Link href={`/staff/live/run/${openRun.run}`}>Run</Link>
              </Button>
            ) : (
              <span
                className="inline-flex"
                title={found.rounds.length === 0 ? NO_ROUNDS : undefined}
              >
                <Button
                  disabled={busy || found.retired || found.rounds.length === 0}
                  onClick={() => void launch()}
                >
                  <Radio /> Launch
                </Button>
              </span>
            )}
            {openRun === null && !found.retired ? (
              <ConfirmAction
                trigger={<Button variant="ghost">Retire</Button>}
                title={`Retire “${found.title}”?`}
                description={RETIRE_NOTE}
                confirmLabel="Retire"
                destructive
                onConfirm={retire}
              />
            ) : null}
          </>
        }
      />

      <div className="max-w-4xl space-y-8">
        <BeforeClass />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Rounds{" "}
            <span className="font-normal text-muted-foreground">
              ({found.rounds.length})
            </span>
          </h2>
          {found.rounds.length === 0 ? (
            <EmptyState icon={Layers} title="No rounds yet" />
          ) : (
            <div className="flex flex-col gap-3">
              {found.rounds.map((round) => (
                <RoundCard key={round.leg} round={round} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Runs</h2>
          {found.runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Never launched.</p>
          ) : (
            <ul className="space-y-2">
              {found.runs.map((run) => (
                <li key={run.run}>
                  <Link
                    href={`/staff/live/run/${run.run}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm">
                        Opened {fullTime(run.openedAt)}
                        {run.closedAt !== null
                          ? ` · closed ${fullTime(run.closedAt)}`
                          : ""}
                      </span>
                      <span className="font-mono text-muted-foreground text-[13px]">
                        {ranWords(run.rounds)}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {run.open ? <Badge>Open</Badge> : null}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

/**
 * What a run came to: the rounds that ran and what the room handed in over
 * them. The former numbers no round of a past run, so the row counts them.
 */
function ranWords(rounds: { figure: { handedIn: number | null } }[]): string {
  if (rounds.length === 0) return "No round ran.";
  const handedIn = rounds.reduce(
    (total, round) => total + (round.figure.handedIn ?? 0),
    0,
  );
  const word = rounds.length === 1 ? "round" : "rounds";
  return `${rounds.length} ${word} · ${handedIn} handed in`;
}

/** One round as it stands: what it asks, what it offers, and what it takes. */
/** Whether the lecturer left the fold open, remembered in this browser. */
const BEFORE_CLASS_KEY = "live.before-class";

/** What to do on the day, one line each, in the room's words. */
const BEFORE_CLASS = [
  "Launch. Open Project on the room's screen.",
  "Read the code aloud. The room joins at the address under it.",
  "Open round 1. Turn on Model sorts, or drag cards into piles.",
  "Close the round. Tap the piles to carry, then open the next round.",
  "Close the run when the room is done. The walls stay.",
];

function recalledBeforeClass(): boolean {
  try {
    return window.localStorage.getItem(BEFORE_CLASS_KEY) === "open";
  } catch {
    // A browser that refuses storage starts closed.
    return false;
  }
}

/**
 * One row, closed until tapped, and the choice kept so a lecturer who knows
 * the app never meets it twice.
 */
function BeforeClass() {
  const [open, setOpen] = useState(recalledBeforeClass);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(BEFORE_CLASS_KEY, next ? "open" : "closed");
    } catch {
      // The choice lasts the page.
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="before-class"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left font-medium outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Before class
        <ChevronRight
          aria-hidden
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      <ol
        id="before-class"
        hidden={!open}
        className="flex flex-col gap-2 border-border border-t px-4 pt-3 pb-4 text-sm"
      >
        {BEFORE_CLASS.map((line, index) => (
          <li key={line} className="flex gap-3">
            <span className="w-4 flex-none font-mono text-muted-foreground">
              {index + 1}
            </span>
            {line}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RoundCard({ round }: { round: RelayRound }) {
  const takes = round.takes[0];
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <RoundToken number={round.number} size="lg" standing="plain" />
      <div className="flex min-w-0 flex-col gap-3">
        <span className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="font-display text-xl font-semibold">{round.title}</h3>
          <span className="text-muted-foreground text-sm capitalize">
            {kindOf(round)}
          </span>
        </span>
        {round.prompt === "" ? null : (
          <p dir="auto" className="min-w-0 text-sm">
            {round.prompt}
          </p>
        )}
        {round.choices.length > 0 ? (
          <ul className="flex flex-col gap-1 text-muted-foreground text-sm">
            {round.choices.map((choice) => (
              <li key={choice} dir="auto">
                {choice}
              </li>
            ))}
          </ul>
        ) : null}
        {round.parts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {round.parts.map((part) => (
              <span
                key={part}
                dir="auto"
                className="rounded-lg border border-border border-dashed px-3 py-1.5 text-muted-foreground text-sm"
              >
                {part}
              </span>
            ))}
          </div>
        ) : null}
        {takes === undefined ? null : takeWords(takes.use) === takes.use ? (
          <span className="font-mono text-muted-foreground text-[13px]">
            takes from {takes.sourceNumber}
          </span>
        ) : (
          <TakesChip
            from={takes.sourceNumber}
            use={takes.use}
            standing="plain"
            className="self-start"
          />
        )}
      </div>
    </div>
  );
}

export default function RelayOverviewPage() {
  return (
    <RequireCapability capability="live:host">
      <RelayOverviewContent />
    </RequireCapability>
  );
}
