"use client";

import { ArrowLeft, Layers } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { useDrafting } from "@/components/live/ai-panel";
import { RELAY_LINES } from "@/components/live/brief-chips";
import { refusalSentence } from "@/components/live/refusals";
import {
  ActButton,
  AddRoundCard,
  RoundEditor,
  TITLE_FIELD,
} from "@/components/live/round-editor";
import { PhoneColumn } from "@/components/live/round-preview";
import { GOING } from "@/components/live/round-proposal";
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

/** A brief on its way here names the ask it was sent as; every other link only opens the box. */
const ASK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Where a reader reads: a line a third of the way down the screen. */
const READING = 1 / 3;

/** The round card that line falls in, or the one nearest it. */
function nearestCard(cards: Map<string, HTMLElement>): string | null {
  const line = window.innerHeight * READING;
  let nearest: string | null = null;
  let gap = Number.POSITIVE_INFINITY;
  for (const [leg, node] of cards) {
    const box = node.getBoundingClientRect();
    const away =
      box.top > line
        ? box.top - line
        : box.bottom < line
          ? line - box.bottom
          : 0;
    if (away < gap) {
      gap = away;
      nearest = leg;
    }
  }
  return nearest;
}

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
  const brief = searchParams.get("ask");
  // The title as it is being typed, and the saved title it was typed over: a
  // name the model gives the relay while the page stands is shown, not typed
  // back over by the field's blur.
  const [typed, setTyped] = useState<string | null>(null);
  const [saved, setSaved] = useState(relay.title);
  if (saved !== relay.title) {
    setSaved(relay.title);
    setTyped(null);
  }
  const title = typed ?? relay.title;
  const [asking, setAsking] = useState(link !== null || brief !== null);
  const open = asking && !relay.retired;
  // The brief the address carries goes out from here, so the page it was
  // written on navigates the moment the relay is planned.
  const [sent, setSent] = useState<number | null>(null);
  const going = useRef(false);
  // The round the phone shows: the card being edited, or the one the reader has
  // scrolled to.
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cards = useRef(new Map<string, HTMLElement>());
  const column = useRef<HTMLDivElement>(null);

  // Scrolling is the reader's own way of saying which round they are on, and
  // only the column shows a phone for it: below lg the column is not laid out,
  // and a tap opens the drawer under the card itself.
  useEffect(() => {
    const follow = () => {
      if (column.current === null || column.current.offsetParent === null)
        return;
      const leg = nearestCard(cards.current);
      if (leg !== null) setSelected(leg);
    };
    follow();
    window.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    };
  }, []);

  useEffect(() => {
    if (brief === null || brief.trim() === "" || going.current) return;
    going.current = true;
    const at = Date.now();
    void api["/live/edits/draft"]({ relay: relay.relay, request: brief }).then(
      (result) => {
        if (isApiError(result)) {
          toast.error(publicErrorMessage(result.error));
          return;
        }
        setSent(at);
      },
    );
    router.replace(`/staff/live/relay/${relay.relay}/edit`);
  }, [brief, relay.relay, router]);

  const drafting = useDrafting({
    relay: relay.relay,
    rounds: relay.rounds,
    title: relay.title,
    open,
    onOpen: setAsking,
    pending: sent !== null || (link !== null && ASK.test(link)),
    since: sent,
    onChanged,
  });

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

  // The line opens itself once proposals stand, and after that only its handle
  // closes it — so what the model named is never put away unread.
  if (!asking && drafting.standing > 0) setAsking(true);

  async function retitle() {
    if (typed === null) return;
    const wanted = typed.trim();
    // A title cleared and left behind is not a title: the saved one comes back.
    if (wanted === "" || wanted === relay.title) {
      setTyped(null);
      return;
    }
    setBusy(true);
    const result = await api["/live/relays/retitle"]({
      relay: relay.relay,
      title: wanted,
    });
    setBusy(false);
    if (isApiError(result)) {
      setTyped(null);
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
        <div className="flex min-w-0 flex-1 flex-col gap-2">
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
              onChange={(event) => setTyped(event.target.value)}
              onBlur={() => void retitle()}
            />
            {relay.retired ? <Badge variant="outline">Retired</Badge> : null}
          </span>
        </div>
        {relay.retired ? null : (
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          {relay.retired ? null : drafting.line}
          {relay.rounds.map((round) => (
            <Fragment key={round.leg}>
              {drafting.adds(round.number)}
              <div
                ref={(node) => {
                  if (node === null) cards.current.delete(round.leg);
                  else cards.current.set(round.leg, node);
                }}
                className={cn(drafting.going(round.leg) && GOING)}
                onFocusCapture={() => setSelected(round.leg)}
              >
                <RoundEditor
                  round={round}
                  rounds={relay.rounds}
                  locked={relay.retired || reached.has(round.leg)}
                  note={
                    reached.has(round.leg)
                      ? refusalSentence("RUN_OPEN", { round: round.number })
                      : null
                  }
                  proposal={drafting.proposal(round.leg)}
                  onChanged={onChanged}
                />
              </div>
              {selected === round.leg ? (
                <div className="lg:hidden">
                  <PhoneColumn
                    rounds={relay.rounds}
                    selected={selected}
                    variant="drawer"
                  />
                </div>
              ) : null}
            </Fragment>
          ))}
          {drafting.adds(relay.rounds.length + 1)}
          {relay.rounds.length === 0 && drafting.standing === 0 ? (
            <div className="max-w-prose space-y-2 text-muted-foreground">
              {RELAY_LINES.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
          {relay.retired ? null : <AddRoundCard busy={busy} onAdd={addRound} />}
          {relay.retired ? null : drafting.bar}
        </div>

        <div ref={column} className="hidden lg:block lg:sticky lg:top-[130px]">
          <PhoneColumn
            rounds={relay.rounds}
            selected={selected}
            variant="column"
          />
        </div>
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
