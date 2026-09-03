"use client";

import { ArrowLeft, Layers, Lock, Sparkles } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { AiPanel } from "@/components/live/ai-panel";
import { copyRelay, relayToCopy } from "@/components/live/copy-relay";
import { AddRoundCard, RoundEditor } from "@/components/live/round-editor";
import { PageContainer } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
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

type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** Live's Describe sends a brief on its way here and names the ask; every other link only opens the panel. */
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
  const [drafting, setDrafting] = useState(link !== null);
  const [busy, setBusy] = useState(false);

  const openRun = relay.runs.find((run) => run.open) ?? null;
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

  async function retitle() {
    const wanted = title.trim();
    if (wanted === "" || wanted === relay.title) return;
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

  async function copy() {
    setBusy(true);
    const result = await copyRelay(relayToCopy(relay));
    setBusy(false);
    if (isApiError(result)) {
      toast.error(publicErrorMessage(result.error));
      return;
    }
    router.push(`/staff/live/relay/${result.relay}`);
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
            href="/staff/live"
            className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
          <Input
            value={title}
            maxLength={200}
            disabled={busy}
            aria-label="Title"
            aria-invalid={title.trim() === ""}
            className="h-auto border-transparent px-0 font-display text-2xl font-semibold shadow-none md:text-3xl"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void retitle()}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className={drafting ? "border-primary text-primary" : undefined}
            onClick={() => setDrafting((shown) => !shown)}
          >
            <Sparkles /> Draft
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void copy()}>
            Copy
          </Button>
          {openRun === null ? (
            <Button
              disabled={busy || relay.rounds.length === 0}
              onClick={() => void launch()}
            >
              Launch
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/staff/live/run/${openRun.run}`}>Run</Link>
            </Button>
          )}
        </div>
      </header>

      {openRun !== null ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <Lock className="size-4 text-primary" />
          <p className="flex-1 text-sm">
            A run is open. Rounds it has reached are fixed.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/staff/live/run/${openRun.run}`}>Go to the run</Link>
          </Button>
        </div>
      ) : null}

      {drafting ? (
        <AiPanel
          relay={relay.relay}
          rounds={relay.rounds}
          pending={link !== null && ASK.test(link)}
          onChanged={onChanged}
        />
      ) : null}

      <div className="flex max-w-4xl flex-col gap-3">
        {relay.rounds.map((round) => (
          <RoundEditor
            key={round.leg}
            round={round}
            rounds={relay.rounds}
            locked={reached.has(round.leg)}
            onChanged={onChanged}
          />
        ))}
        <AddRoundCard disabled={busy} onAdd={addRound} />
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
