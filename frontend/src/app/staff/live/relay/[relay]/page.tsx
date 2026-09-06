"use client";

import { ArrowLeft, ChevronRight, Layers, Radio } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { FormTag, RETIRE_NOTE } from "@/components/live/quiz-meta";
import { refusalSentence } from "@/components/live/refusals";
import { bareVote } from "@/components/live/round-preview";
import {
  RoundToken,
  TakesChip,
  takeWords,
} from "@/components/live/round-token";
import {
  kindOf,
  launchRefusal,
  NO_ROUNDS,
  type RelayRound,
} from "@/components/live/rounds";
import { RunsHeading } from "@/components/live/runs-heading";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
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
      <PageContainer width="wide">
        <LoadingState />
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer width="wide">
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );
  }

  const found: Relay | null = data?.relay ?? null;
  if (found === null) {
    return (
      <PageContainer width="wide">
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
  // Why the relay cannot launch yet, said on the button that would launch it.
  const notYet =
    found.rounds.length === 0
      ? NO_ROUNDS
      : found.rounds.some(bareVote)
        ? refusalSentence("NO_CHOICES")
        : undefined;

  async function launch() {
    setBusy(true);
    const result = await api["/live/relays/launch"]({ relay });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(launchRefusal(result.error));
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
    <PageContainer width="wide">
      <PageHeader
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
            <FormTag form="relay" />
            {found.retired ? <Fact.Status status="RETIRED" /> : null}
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
              <span className="inline-flex" title={notYet}>
                {/* Busy, the button keeps its focus: it is out by aria, not
                    by a disabled that hands the focus back to the page. */}
                <Button
                  disabled={found.retired || notYet !== undefined}
                  aria-disabled={busy || undefined}
                  onClick={busy ? undefined : () => void launch()}
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

      <div className="space-y-8">
        <BeforeClass />

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Rounds{" "}
            <span className="font-normal text-muted-foreground">
              ({found.rounds.length})
            </span>
          </h2>
          {found.rounds.length === 0 ? (
            <EmptyState icon={Layers} title="No rounds yet." />
          ) : (
            <div className="flex flex-col gap-3">
              {found.rounds.map((round) => (
                <RoundCard
                  key={round.leg}
                  round={round}
                  rounds={found.rounds}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <RunsHeading />
          {found.runs.length === 0 ? (
            <EmptyState icon={Radio} title="Never launched." />
          ) : (
            <ul className="space-y-2">
              {found.runs.map((run) => (
                <li key={run.run}>
                  <Link
                    href={`/staff/live/run/${run.run}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <Facts className="text-sm">
                        <Fact.Range
                          verb={run.closedAt === null ? undefined : "Opened"}
                          from={run.openedAt}
                          to={run.closedAt}
                        />
                      </Facts>
                      {run.rounds.length === 0 ? (
                        <span className="font-mono text-muted-foreground text-[13px]">
                          {NO_ROUND_RAN}
                        </span>
                      ) : (
                        <Facts className="font-mono text-[13px]">
                          <Fact.Count n={run.rounds.length} noun="round" />
                          <Fact.Count>
                            {handedIn(run.rounds)} handed in
                          </Fact.Count>
                        </Facts>
                      )}
                    </div>
                    <span className="flex items-center gap-2">
                      {run.open ? <Fact.Status status="OPEN" /> : null}
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

/** A run whose rounds all went away leaves the row nothing to count. */
const NO_ROUND_RAN = "No round ran.";

/**
 * What the room handed in over a run's rounds. The former numbers no round of
 * a past run, so the row counts them.
 */
function handedIn(rounds: { figure: { handedIn: number | null } }[]): number {
  return rounds.reduce(
    (total, round) => total + (round.figure.handedIn ?? 0),
    0,
  );
}

/** One round as it stands: what it asks, what it offers, and what it takes. */
/** Whether the lecturer left the fold open, remembered in this browser. */
const BEFORE_CLASS_KEY = "live.before-class";

/** What to do on the day, one line each, in the room's words. */
const BEFORE_CLASS = [
  "Sign in fresh today, here and on the room's screen. A sign-in lasts one day.",
  "Launch. Open Project on the room's screen.",
  "Read the code and the address aloud. The room joins there.",
  "Open round 1 when the phones are out.",
  "The model sorts while the room writes. Close settles the wall; then it is yours to sort and pick.",
  "Close the round. Pick is on Top: the fullest piles. Tap a pile to pick by hand. Open the next round.",
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

function RoundCard({
  round,
  rounds,
}: {
  round: RelayRound;
  /** The relay's rounds, so a take can say the title of the one it reads. */
  rounds: RelayRound[];
}) {
  const takes = round.takes[0];
  const kind = kindOf(round);
  const source =
    takes === undefined
      ? null
      : (rounds.find((entry) => entry.number === takes.sourceNumber) ?? null);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 rounded-xl border border-border bg-card px-5 py-4">
      <RoundToken number={round.number} size="lg" standing="plain" />
      <div className="flex min-w-0 flex-col gap-3">
        <span className="flex flex-wrap items-baseline gap-2.5">
          <h3 className="font-display text-xl font-semibold">{round.title}</h3>
          <span className="text-muted-foreground text-sm capitalize">
            {kind}
          </span>
        </span>
        {round.prompt === "" ? null : (
          <p dir="auto" className="min-w-0 text-sm">
            {round.prompt}
          </p>
        )}
        {kind === "vote" && round.choices.length > 0 ? (
          <ul className="flex flex-col gap-1 text-muted-foreground text-sm">
            {round.choices.map((choice) => (
              <li key={choice} dir="auto">
                {choice}
              </li>
            ))}
          </ul>
        ) : null}
        {kind === "list" && round.parts.length > 0 ? (
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
        {round.piles.length === 0 ? null : (
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Standing piles</span>
            <ul className="flex flex-col gap-1 text-sm">
              {round.piles.map((pile) => (
                <li
                  key={pile.pile}
                  dir="auto"
                  className="flex min-w-0 flex-wrap items-baseline gap-2"
                >
                  <span>{pile.name}</span>
                  {pile.description === "" ? null : (
                    <span className="min-w-0 text-muted-foreground">
                      {pile.description}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {round.notes === "" ? null : (
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Notes for the sorter</span>
            <p
              dir="auto"
              className="min-w-0 whitespace-pre-wrap text-muted-foreground text-sm"
            >
              {round.notes}
            </p>
          </div>
        )}
        {takes === undefined ? null : takeWords(takes.use) === takes.use ? (
          <span className="font-mono text-muted-foreground text-[13px]">
            takes from {takes.sourceNumber}
          </span>
        ) : (
          <span
            className="flex min-w-0 items-center gap-2 self-start"
            title={
              source === null
                ? undefined
                : `from ${takes.sourceNumber} ${source.title}`
            }
          >
            <TakesChip
              from={takes.sourceNumber}
              use={takes.use}
              standing="plain"
            />
            {source === null ? null : (
              <span className="hidden min-w-0 truncate text-muted-foreground text-[13px] sm:block">
                {source.title}
              </span>
            )}
          </span>
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
