"use client";

import { ArrowLeft, Layers, Sparkles } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { AiPanel } from "@/components/live/ai-panel";
import { refusalSentence } from "@/components/live/refusals";
import {
  ActButton,
  AddRoundCard,
  RoundEditor,
  TITLE_FIELD,
} from "@/components/live/round-editor";
import { NO_ROUNDS } from "@/components/live/rounds";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/hooks/use-query";
import {
  api,
  isApiError,
  type Output,
  publicErrorMessage,
  unwrap,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** Draft with AI sends a brief on its way here and names the ask; every other link only opens the panel. */
const ASK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function RelaySetupContent() {
  const { relay } = useParams<{ relay: string }>();
  const { session } = useAuth();

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

  const found = data?.relay ?? null;
  if (found === null) {
    return (
      <PageContainer width="wide">
        <EmptyState
          icon={Layers}
          title="No such relay"
          action={
            <Button size="sm" asChild>
              <Link href="/staff/live">Live</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return <RelaySetup key={found.relay} relay={found} onChanged={refetch} />;
}

function RelaySetup({
  relay,
  onChanged,
}: {
  relay: Relay;
  onChanged: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const link = searchParams.get("draft");
  const [title, setTitle] = useState(relay.title);
  // The panel opens itself once lines are waiting, and after that only the
  // button closes it — so a line settled to nothing does not take it away.
  const [shown, setShown] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const openRun = relay.runs.find((run) => run.open) ?? null;
  const { data: offered } = useQuery(
    () => api["/live/edits/offerings"]({ relay: relay.relay }).then(unwrap),
    [relay],
  );
  const pending = (offered?.offerings[0]?.lines ?? []).filter(
    (line) => line.standing === "pending" && line.kind !== "keep",
  ).length;
  const { data: running } = useQuery(
    openRun === null
      ? null
      : () => api["/live/relays/run"]({ run: openRun.run }).then(unwrap),
    [openRun?.run, relay],
  );
  const reached = new Set(
    (running?.run?.rounds ?? [])
      .filter((round) => round.round !== null)
      .map((round) => round.leg),
  );

  if (shown === null && (link !== null || pending > 0)) setShown(true);
  const drafting = shown ?? false;

  async function retitle() {
    const wanted = title.trim();
    // A title cleared and left behind is not a title: the saved one comes back.
    if (wanted === "") {
      setTitle(relay.title);
      return;
    }
    if (wanted === relay.title) return;
    setBusy(true);
    const result = await api["/live/relays/retitle"]({
      relay: relay.relay,
      title: wanted,
    });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    onChanged();
  }

  async function launch() {
    setBusy(true);
    const result = await api["/live/relays/launch"]({ relay: relay.relay });
    if (isApiError(result)) {
      setBusy(false);
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/run/${result.run}`);
  }

  async function addRound(
    roundTitle: string,
    roundPrompt: string,
  ): Promise<boolean> {
    setBusy(true);
    const result = await api["/live/relays/add-round"]({
      relay: relay.relay,
      title: roundTitle,
      prompt: roundPrompt,
      parts: [],
      cap: 0,
      choices: [],
    });
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return false;
    }
    onChanged();
    return true;
  }

  return (
    <PageContainer width="wide">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-xl">
          <Link
            href={`/staff/live/relay/${relay.relay}`}
            className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Overview
          </Link>
          <span className="flex flex-wrap items-center gap-3">
            <Input
              value={title}
              maxLength={200}
              disabled={relay.retired}
              readOnly={busy}
              aria-label="Title"
              aria-invalid={title.trim() === ""}
              className={cn(TITLE_FIELD, "min-w-0 flex-1 text-2xl md:text-3xl")}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void retitle()}
            />
            {relay.retired ? <Badge variant="outline">Retired</Badge> : null}
          </span>
        </div>
        {relay.retired ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              aria-expanded={drafting}
              aria-controls="draft-panel"
              className={drafting ? "border-primary text-primary" : undefined}
              onClick={() => setShown(!drafting)}
            >
              <Sparkles /> Draft with AI
              {pending > 0 ? (
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] text-primary-foreground">
                  {pending}
                </span>
              ) : null}
            </Button>
            {openRun === null ? (
              <span
                className="inline-flex"
                title={relay.rounds.length === 0 ? NO_ROUNDS : undefined}
              >
                <ActButton
                  out={relay.rounds.length === 0}
                  busy={busy}
                  onClick={() => void launch()}
                >
                  Launch
                </ActButton>
              </span>
            ) : (
              <Button asChild>
                <Link href={`/staff/live/run/${openRun.run}`}>Run</Link>
              </Button>
            )}
          </div>
        )}
      </header>

      <div id="draft-panel">
        {drafting && !relay.retired ? (
          <AiPanel
            relay={relay.relay}
            rounds={relay.rounds}
            pending={link !== null && ASK.test(link)}
            onChanged={onChanged}
          />
        ) : null}
      </div>

      <div className="flex max-w-4xl flex-col gap-3">
        {relay.rounds.map((round) => (
          <RoundEditor
            key={round.leg}
            round={round}
            rounds={relay.rounds}
            locked={relay.retired || reached.has(round.leg)}
            note={
              reached.has(round.leg)
                ? refusalSentence("RUN_OPEN", { round: round.number })
                : null
            }
            onChanged={onChanged}
          />
        ))}
        {relay.retired ? null : <AddRoundCard busy={busy} onAdd={addRound} />}
      </div>
    </PageContainer>
  );
}

export default function RelaySetupPage() {
  return (
    <RequireCapability capability="live:host">
      <Suspense
        fallback={
          <PageContainer width="wide">
            <LoadingState />
          </PageContainer>
        }
      >
        <RelaySetupContent />
      </Suspense>
    </RequireCapability>
  );
}
