"use client";

import { ChevronDown, Radio, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import {
  FormBadge,
  QUIZ_NOT_READY_MESSAGE,
  RETIRE_NOTE,
} from "@/components/live/quiz-meta";
import { LiveRow, RoomCode } from "@/components/live/relay-row";
import { Figure, RoundStrip } from "@/components/live/round-token";
import { NO_ROUNDS, standingOf } from "@/components/live/rounds";
import { RunLaunchButton } from "@/components/live/run-launch-button";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  isApiError,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toDate } from "@/lib/format";

type Relay = Output<"/live/relays/list">["relays"][number];
type Shelved = Output<"/live/quizzes/list">["questionnaires"][number];

type Entry =
  | { kind: "relay"; at: number; retired: boolean; relay: Relay }
  | {
      kind: "questionnaire";
      at: number;
      retired: boolean;
      questionnaire: Shelved;
    };

/** The three things New makes, in the order the menu offers them. */
const KINDS = [
  { kind: "quiz", label: "Quiz" },
  { kind: "survey", label: "Survey" },
  { kind: "relay", label: "Relay" },
] as const;

function when(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

function LiveListContent() {
  const { session } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const {
    data: shelf,
    loading: loadingShelf,
    error: shelfError,
    refetch: refetchShelf,
  } = useQuery(
    session ? () => api["/live/quizzes/list"]({}).then(unwrap) : null,
    [session],
  );
  const {
    data: relayList,
    loading: loadingRelays,
    error: relayError,
    refetch: refetchRelays,
  } = useQuery(
    session ? () => api["/live/relays/list"]({}).then(unwrap) : null,
    [session],
  );

  const questionnaires = shelf?.questionnaires ?? [];
  const relays = relayList?.relays ?? [];

  const entries: Entry[] = [
    ...relays.map(
      (relay): Entry => ({
        kind: "relay",
        at: when(relay.createdAt),
        retired: relay.retired,
        relay,
      }),
    ),
    ...questionnaires.map(
      (questionnaire): Entry => ({
        kind: "questionnaire",
        at: when(questionnaire.createdAt),
        retired: questionnaire.retired,
        questionnaire,
      }),
    ),
  ].sort((left, right) => right.at - left.at);

  const standing = entries.filter((entry) => !entry.retired);
  const retired = entries.filter((entry) => entry.retired);
  // The state column stands only while a run is open somewhere on the shelf;
  // with nothing live the rows start at their titles.
  const anyLive = standing.some((entry) =>
    entry.kind === "relay"
      ? entry.relay.run !== null
      : entry.questionnaire.openRun !== null,
  );

  function refetch() {
    refetchShelf();
    refetchRelays();
  }

  async function launch(relay: string) {
    setBusy(true);
    const result = await api["/live/relays/launch"]({ relay });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/run/${result.run}`);
  }

  async function retireRelay(relay: string) {
    const result = await api["/live/relays/retire"]({ relay });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    refetch();
  }

  async function retireQuestionnaire(questionnaire: string) {
    const result = await api["/live/quizzes/retire"]({ questionnaire });
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    refetch();
  }

  const loading =
    (loadingShelf && shelf === null) || (loadingRelays && relayList === null);
  const error = shelfError ?? relayError;

  return (
    <PageContainer width="wide">
      <header className="mb-5 flex items-end justify-between gap-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Live
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/staff/live/draft">
              <Sparkles /> Draft with AI
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-foreground text-background hover:bg-foreground/90">
                New <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {KINDS.map((entry) => (
                <DropdownMenuItem key={entry.kind} asChild>
                  <Link href={`/staff/live/new?kind=${entry.kind}`}>
                    {entry.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {loading ? (
        <LoadingState />
      ) : error !== null ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : standing.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="Nothing yet"
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {KINDS.map((entry) => (
                <Button key={entry.kind} size="sm" variant="outline" asChild>
                  <Link href={`/staff/live/new?kind=${entry.kind}`}>
                    New {entry.label.toLowerCase()}
                  </Link>
                </Button>
              ))}
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {standing.map((entry) =>
            entry.kind === "relay" ? (
              <RelayEntry
                key={entry.relay.relay}
                relay={entry.relay}
                stateColumn={anyLive}
                busy={busy}
                onLaunch={() => void launch(entry.relay.relay)}
                onRetire={() => retireRelay(entry.relay.relay)}
              />
            ) : (
              <QuestionnaireEntry
                key={entry.questionnaire.questionnaire}
                entry={entry.questionnaire}
                stateColumn={anyLive}
                onRetire={() =>
                  retireQuestionnaire(entry.questionnaire.questionnaire)
                }
              />
            ),
          )}
        </div>
      )}

      {retired.length > 0 ? (
        <section className="mt-6">
          <button
            type="button"
            onClick={() => setShowRetired((shown) => !shown)}
            className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
          >
            {showRetired ? "Hide retired" : `Show retired (${retired.length})`}
          </button>
          {showRetired ? (
            <div className="mt-3 flex flex-col gap-2">
              {retired.map((entry) =>
                entry.kind === "relay" ? (
                  <RetiredEntry
                    key={entry.relay.relay}
                    href={`/staff/live/relay/${entry.relay.relay}`}
                    title={entry.relay.title}
                    form="relay"
                    rounds={entry.relay.rounds}
                    stateColumn={anyLive}
                  />
                ) : (
                  <RetiredEntry
                    key={entry.questionnaire.questionnaire}
                    href={`/staff/live/${entry.questionnaire.questionnaire}`}
                    title={entry.questionnaire.title}
                    form={entry.questionnaire.form}
                    stateColumn={anyLive}
                  />
                ),
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </PageContainer>
  );
}

function RelayEntry({
  relay,
  stateColumn,
  busy,
  onLaunch,
  onRetire,
}: {
  relay: Relay;
  stateColumn: boolean;
  busy: boolean;
  onLaunch: () => void;
  onRetire: () => Promise<void>;
}) {
  const live = relay.run !== null;
  const { begun, handedIn } = relay.figure;

  // A live row carries both: the figure of the round that is open, and the
  // code the room is still joined by under it.
  const aside = !live ? undefined : (
    <span className="flex flex-col gap-1">
      {relay.openRound !== null && handedIn !== null && begun !== null ? (
        <Figure size="sm" value={handedIn} of={begun} />
      ) : null}
      {relay.code === null ? null : <RoomCode code={relay.code} />}
    </span>
  );

  return (
    <LiveRow
      live={live}
      stateColumn={stateColumn}
      title={
        <>
          <Link
            href={`/staff/live/relay/${relay.relay}`}
            className="min-w-0 break-words hover:text-primary"
          >
            {relay.title}
          </Link>
          <FormBadge form="relay" />
        </>
      }
      middle={
        relay.rounds.length === 0 ? null : (
          <RoundStrip
            rounds={relay.rounds.map((round) => ({
              number: round.number,
              title: round.title,
              standing: live ? standingOf(round) : "plain",
            }))}
          />
        )
      }
      aside={aside}
      actions={
        live ? (
          <Button size="sm" asChild>
            <Link href={`/staff/live/run/${relay.run}`}>Run</Link>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/staff/live/relay/${relay.relay}/edit`}>Edit</Link>
            </Button>
            <span
              className="inline-flex"
              title={relay.rounds.length === 0 ? NO_ROUNDS : undefined}
            >
              <Button
                variant="outline"
                size="sm"
                disabled={busy || relay.rounds.length === 0}
                onClick={onLaunch}
              >
                <Radio /> Launch
              </Button>
            </span>
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="sm">
                  Retire
                </Button>
              }
              title={`Retire “${relay.title}”?`}
              description={RETIRE_NOTE}
              confirmLabel="Retire"
              destructive
              onConfirm={onRetire}
            />
          </>
        )
      }
    />
  );
}

function QuestionnaireEntry({
  entry,
  stateColumn,
  onRetire,
}: {
  entry: Shelved;
  stateColumn: boolean;
  onRetire: () => Promise<void>;
}) {
  const live = entry.openRun !== null;
  // The two conditions the desk states, read off the entry so the row never
  // offers a launch the sheet would refuse.
  const launchHint =
    entry.questions === 0
      ? "Add a question first."
      : entry.form === "quiz" && !entry.proposes
        ? QUIZ_NOT_READY_MESSAGE
        : undefined;

  return (
    <LiveRow
      live={live}
      stateColumn={stateColumn}
      title={
        <>
          <Link
            href={`/staff/live/${entry.questionnaire}`}
            className="min-w-0 break-words hover:text-primary"
          >
            {entry.title}
          </Link>
          <FormBadge form={entry.form} />
        </>
      }
      actions={
        live ? (
          <Button size="sm" asChild>
            <Link href={`/staff/live/run/${entry.openRun}`}>Run</Link>
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/staff/live/${entry.questionnaire}/edit`}>Edit</Link>
            </Button>
            <RunLaunchButton
              questionnaire={entry.questionnaire}
              disabled={launchHint !== undefined}
              hint={launchHint}
              size="sm"
              variant="outline"
            />
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="sm">
                  Retire
                </Button>
              }
              title={`Retire “${entry.title}”?`}
              description={RETIRE_NOTE}
              confirmLabel="Retire"
              destructive
              onConfirm={onRetire}
            />
          </>
        )
      }
    />
  );
}

function RetiredEntry({
  href,
  title,
  form,
  rounds = [],
  stateColumn,
}: {
  href: string;
  title: string;
  form: string;
  /** A retired relay keeps its rounds, which is what the row is folded away with. */
  rounds?: { number: number; title: string }[];
  stateColumn: boolean;
}) {
  return (
    <LiveRow
      live={false}
      stateColumn={stateColumn}
      className="opacity-80"
      middle={
        rounds.length === 0 ? null : (
          <RoundStrip
            rounds={rounds.map((round) => ({
              number: round.number,
              title: round.title,
              standing: "plain" as const,
            }))}
          />
        )
      }
      title={
        <>
          <Link href={href} className="min-w-0 break-words hover:text-primary">
            {title}
          </Link>
          <FormBadge form={form} />
        </>
      }
    />
  );
}

export default function LiveListPage() {
  return (
    <RequireCapability capability="live:host">
      <LiveListContent />
    </RequireCapability>
  );
}
