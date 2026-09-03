"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Link } from "@/components/link";
import {
  type CopyableRelay,
  copyRelay,
  titleFromBrief,
} from "@/components/live/copy-relay";
import { DECK } from "@/components/live/deck";
import { FormBadge, QUIZ_NOT_READY_MESSAGE } from "@/components/live/quiz-meta";
import {
  LiveRow,
  type LiveStanding,
  RoomCode,
} from "@/components/live/relay-row";
import { Figure, RoundStrip } from "@/components/live/round-token";
import { standingOf } from "@/components/live/rounds";
import { RunLaunchButton } from "@/components/live/run-launch-button";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  | { kind: "relay"; at: number; relay: Relay }
  | { kind: "questionnaire"; at: number; questionnaire: Shelved };

const EXAMPLE =
  "two rounds: three verbs for a concept, then a stranger guesses it from the verbs alone";

function relayStanding(relay: Relay): LiveStanding {
  if (relay.openRound !== null) return "open";
  if (relay.run !== null) return "launched";
  if (relay.runs > 0) return "closed";
  return "authored";
}

function questionnaireStanding(entry: Shelved): LiveStanding {
  if (entry.openRun !== null) return "open";
  if (entry.retired) return "closed";
  return "authored";
}

function when(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

function LiveListContent() {
  const { session } = useAuth();
  const router = useRouter();
  const [describing, setDescribing] = useState(false);
  const [busy, setBusy] = useState(false);

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
        relay,
      }),
    ),
    ...questionnaires.map(
      (questionnaire): Entry => ({
        kind: "questionnaire",
        at: when(questionnaire.createdAt),
        questionnaire,
      }),
    ),
  ].sort((left, right) => right.at - left.at);

  function refetch() {
    refetchShelf();
    refetchRelays();
  }

  async function plan(title: string) {
    setBusy(true);
    const result = await api["/live/relays/plan"]({ title });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/relay/${result.relay}`);
  }

  async function copy(source: CopyableRelay) {
    setBusy(true);
    const result = await copyRelay(source);
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/relay/${result.relay}`);
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

  // A closed relay's runs are only on the relay itself, so the wall is reached
  // by reading it back and going to the run it ran last.
  async function wall(relay: string) {
    setBusy(true);
    const result = await api["/live/relays/get"]({ relay });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    const run = result.relay?.runs[0]?.run;
    if (run === undefined) {
      toast.error(publicErrorMessage("NOT_FOUND"));
      return;
    }
    router.push(`/staff/live/run/${run}`);
  }

  async function retire(questionnaire: string) {
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
          <Button
            variant="outline"
            className={describing ? "border-primary text-primary" : undefined}
            onClick={() => setDescribing((shown) => !shown)}
          >
            <Sparkles /> Describe
          </Button>
          <Button
            disabled={busy}
            className="bg-foreground text-background hover:bg-foreground/90"
            onClick={() => void plan("New relay")}
          >
            New relay
          </Button>
        </div>
      </header>

      {describing ? <DescribePanel /> : null}

      <div className="flex flex-col gap-6">
        <div className="order-2 rounded-xl border border-border bg-card p-5 sm:order-1">
          <div className="flex flex-col gap-1.5">
            {DECK.map((entry) => (
              <div
                key={entry.key}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-3.5 py-2.5"
              >
                <span className="min-w-0 flex-1 break-words font-medium">
                  {entry.title}
                </span>
                <RoundStrip
                  rounds={entry.rounds.map((round, index) => ({
                    number: index + 1,
                    title: round.title,
                    standing: "plain" as const,
                  }))}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void copy(entry)}
                >
                  Copy
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 sm:order-2">
          {loading ? (
            <LoadingState />
          ) : error !== null ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : entries.length === 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void plan("New relay")}
              className="flex min-h-14 w-full items-center justify-center rounded-xl border border-border border-dashed px-4 py-3 text-muted-foreground text-sm hover:text-foreground disabled:opacity-50"
            >
              New relay
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {entries.map((entry) =>
                entry.kind === "relay" ? (
                  <RelayEntry
                    key={entry.relay.relay}
                    relay={entry.relay}
                    busy={busy}
                    onLaunch={() => void launch(entry.relay.relay)}
                    onWall={() => void wall(entry.relay.relay)}
                  />
                ) : (
                  <QuestionnaireEntry
                    key={entry.questionnaire.questionnaire}
                    entry={entry.questionnaire}
                    onRetire={() => retire(entry.questionnaire.questionnaire)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/** A brief, and the relay it plans: the model drafts the rounds on the setup page. */
function DescribePanel() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);

  async function draft() {
    const brief = request.trim();
    if (brief === "") return;
    setBusy(true);
    const planned = await api["/live/relays/plan"]({
      title: titleFromBrief(brief),
    });
    if (isApiError(planned)) {
      setBusy(false);
      toast.error(publicErrorMessage(planned.error));
      return;
    }
    const asked = await api["/live/edits/draft"]({
      relay: planned.relay,
      request: brief,
    });
    if (isApiError(asked)) {
      setBusy(false);
      toast.error(publicErrorMessage(asked.error));
      return;
    }
    router.push(`/staff/live/relay/${planned.relay}?draft=${asked.asking}`);
  }

  return (
    <div className="mb-6 flex flex-col gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <Textarea
        value={request}
        onChange={(event) => setRequest(event.target.value)}
        placeholder={EXAMPLE}
        rows={4}
        className="min-h-24 bg-card"
      />
      <Button
        size="sm"
        className="self-start"
        disabled={busy || request.trim() === ""}
        onClick={() => void draft()}
      >
        Draft
      </Button>
    </div>
  );
}

function RelayEntry({
  relay,
  busy,
  onLaunch,
  onWall,
}: {
  relay: Relay;
  busy: boolean;
  onLaunch: () => void;
  onWall: () => void;
}) {
  const standing = relayStanding(relay);
  const { begun, handedIn } = relay.figure;

  const aside =
    standing === "open" && handedIn !== null && begun !== null ? (
      <Figure size="sm" value={handedIn} of={begun} />
    ) : standing === "launched" && relay.code !== null ? (
      <RoomCode code={relay.code} />
    ) : undefined;

  return (
    <LiveRow
      standing={standing}
      title={
        <Link
          href={`/staff/live/relay/${relay.relay}`}
          className="min-w-0 break-words hover:text-primary"
        >
          {relay.title}
        </Link>
      }
      middle={
        relay.rounds.length === 0 ? null : (
          <RoundStrip
            rounds={relay.rounds.map((round) => ({
              number: round.number,
              title: round.title,
              standing:
                standing !== "open" && round.round === null
                  ? "plain"
                  : standingOf(round),
            }))}
          />
        )
      }
      aside={aside}
      actions={
        standing === "open" || standing === "launched" ? (
          <Button
            size="sm"
            variant={standing === "open" ? "default" : "outline"}
            asChild
          >
            <Link href={`/staff/live/run/${relay.run}`}>Run</Link>
          </Button>
        ) : standing === "closed" ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={onWall}>
            Wall
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href={`/staff/live/relay/${relay.relay}`}>Edit</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || relay.rounds.length === 0}
              onClick={onLaunch}
            >
              Launch
            </Button>
          </>
        )
      }
    />
  );
}

function QuestionnaireEntry({
  entry,
  onRetire,
}: {
  entry: Shelved;
  onRetire?: () => Promise<void>;
}) {
  const standing = questionnaireStanding(entry);
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
      standing={standing}
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
        <>
          {entry.openRun !== null ? (
            <Button size="sm" asChild>
              <Link href={`/staff/live/run/${entry.openRun}`}>Run</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/staff/live/${entry.questionnaire}`}>Edit</Link>
              </Button>
              {entry.retired ? null : (
                <RunLaunchButton
                  questionnaire={entry.questionnaire}
                  disabled={launchHint !== undefined}
                  hint={launchHint}
                  size="sm"
                  variant="outline"
                />
              )}
            </>
          )}
          {onRetire && entry.openRun === null && !entry.retired ? (
            <ConfirmAction
              trigger={
                <Button variant="ghost" size="sm">
                  Retire
                </Button>
              }
              title={`Retire “${entry.title}”?`}
              description="It can no longer be edited or launched. Past runs and their answers are retained."
              confirmLabel="Retire"
              destructive
              onConfirm={onRetire}
            />
          ) : null}
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
