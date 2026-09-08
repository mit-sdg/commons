"use client";

import { ArrowLeft, Layers } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/components/link";
import { useDrafting } from "@/components/live/ai-panel";
import { RELAY_LINES } from "@/components/live/brief-chips";
import { RelayGuideEditor } from "@/components/live/host-guide";
import { refusalSentence } from "@/components/live/refusals";
import {
  ActButton,
  AddRoundCard,
  RoundEditor,
  TITLE_FIELD,
} from "@/components/live/round-editor";
import { bareVote, PhoneColumn } from "@/components/live/round-preview";
import { GOING } from "@/components/live/round-proposal";
import { launchRefusal, NO_ROUNDS } from "@/components/live/rounds";
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
import { ranSentence } from "@/lib/format";
import { cn } from "@/lib/utils";

type Relay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** A brief on its way here names the ask it was sent as; every other link only opens the box. */
const ASK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The card the phone is showing. Focus already outlines a card it is inside;
 * a card reached by scrolling or by a click on its chrome holds no focus, so
 * it is marked the same way rather than in a second language.
 */
const SHOWN =
  "[&>div]:outline [&>div]:outline-2 [&>div]:outline-primary [&>div]:-outline-offset-2";

/** Where a reader reads: a line a third of the way down the screen. */
const READING = 1 / 3;

/** The header gap the phone keeps below the top of the screen. */
const HEADROOM = 130;

/** The gap it keeps above the bottom of the screen. */
const FOOTROOM = 16;

/** How the phone travels to a round the reader has just picked. */
const SLIDE = "transform 300ms ease-out";

/** How long after the page last moved a selection still counts as scrolled to. */
const SCROLLED = 200;

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
  const phone = useRef<HTMLDivElement>(null);
  // When the page last moved under the phone.
  const moved = useRef(0);

  // Scrolling is the reader's own way of saying which round they are on, and
  // only the column shows a phone for it: below lg the column is not laid out,
  // and a tap opens the drawer under the card itself.
  useEffect(() => {
    const follow = () => {
      if (column.current === null || column.current.offsetParent === null)
        return;
      // A round holding the focus is the reader saying which round they are on;
      // the scroll a click into it causes must not take the column off it.
      const held = document.activeElement;
      if (
        held !== null &&
        (phone.current?.contains(held) ||
          [...cards.current.values()].some((node) => node.contains(held)))
      )
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

  // The phone rides level with the card the column is on: the same card offsets
  // the follow reads, held inside the screen and inside the column's own run.
  useEffect(() => {
    const rail = column.current;
    const box = phone.current;
    if (rail === null || box === null) return;
    const place = (sliding: boolean) => {
      // Below lg the column is not laid out and the drawer shows the round.
      if (rail.offsetParent === null) return;
      const card = selected === null ? undefined : cards.current.get(selected);
      const available =
        window.innerHeight -
        Math.max(HEADROOM, rail.getBoundingClientRect().top) -
        FOOTROOM;
      box.style.setProperty(
        "--preview-height",
        `${Math.max(100, available)}px`,
      );
      const tall = box.offsetHeight;
      // A row shorter than the phone is stretched to it, so the phone never
      // spills past the rounds into whatever follows them.
      rail.style.minHeight = `${tall}px`;
      const run = rail.getBoundingClientRect();
      // A phone too tall for the screen is held to the header gap and no lower.
      const lowest = Math.max(HEADROOM, window.innerHeight - tall - FOOTROOM);
      const top =
        card === undefined ? run.top : card.getBoundingClientRect().top;
      const wanted = Math.min(Math.max(top, HEADROOM), lowest);
      const offset = Math.min(
        Math.max(wanted - run.top, 0),
        Math.max(run.height - tall, 0),
      );
      const shift = `translateY(${Math.round(offset)}px)`;
      // A scroll that leaves the phone where it stands must not cut a slide off.
      if (box.style.transform === shift) return;
      box.style.transition = sliding ? SLIDE : "none";
      box.style.transform = shift;
    };
    // A round reached by scrolling is already moving; only one the reader picked
    // is worth a slide, and a slide struck mid-scroll would only stutter.
    place(Date.now() - moved.current > SCROLLED);
    const settle = () => {
      moved.current = Date.now();
      place(false);
    };
    window.addEventListener("scroll", settle, { passive: true });
    window.addEventListener("resize", settle);
    // A sample landing makes the phone taller, and the clamp reads its height.
    const grown = new ResizeObserver(() => place(false));
    grown.observe(box);
    return () => {
      window.removeEventListener("scroll", settle);
      window.removeEventListener("resize", settle);
      grown.disconnect();
    };
  }, [selected, relay.rounds]);

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
    guidance: relay,
    relay: relay.relay,
    rounds: relay.rounds,
    title: relay.title,
    open,
    onOpen: setAsking,
    pending: sent !== null || (link !== null && ASK.test(link)),
    since: sent,
    onChanged,
  });

  // Why the relay cannot launch yet, said on the button that would launch it.
  const notYet =
    relay.rounds.length === 0
      ? NO_ROUNDS
      : relay.rounds.some(bareVote)
        ? refusalSentence("NO_CHOICES")
        : undefined;

  const openRun = relay.runs.find((run) => run.open) ?? null;
  const ran = ranSentence(relay.runs);
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
      toast.error(launchRefusal(result.error));
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
    // The round just written is the one its author is on, so the phone shows
    // it. Nothing else moves the selection here: the card is not focused and
    // no scroll follows, so without this the column keeps its old round.
    setSelected(result.leg);
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
          {ran === "" ? null : (
            <Link
              href={`/staff/live/relay/${relay.relay}#runs`}
              className="self-start text-muted-foreground text-sm hover:text-foreground"
            >
              {ran}
            </Link>
          )}
        </div>
        {relay.retired ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {openRun === null ? (
              <span className="inline-flex" title={notYet}>
                <ActButton
                  out={notYet !== undefined}
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
          <RelayGuideEditor relay={relay} onChanged={onChanged} />
          {relay.rounds.map((round) => (
            <Fragment key={round.leg}>
              {drafting.adds(round.number)}
              <div
                ref={(node) => {
                  if (node === null) cards.current.delete(round.leg);
                  else cards.current.set(round.leg, node);
                }}
                className={cn(
                  drafting.going(round.leg) && GOING,
                  selected === round.leg && SHOWN,
                )}
                onFocusCapture={() => setSelected(round.leg)}
                // A click anywhere on the card says which round the reader is
                // on, not only a click that lands in a field. The keyboard
                // reaches the same selection by focus, above.
                onClick={() => setSelected(round.leg)}
              >
                <RoundEditor
                  round={round}
                  rounds={relay.rounds}
                  locked={relay.retired || reached.has(round.leg)}
                  retired={relay.retired}
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
                    retired={relay.retired}
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

        <div ref={column} className="relative hidden self-stretch lg:block">
          <div ref={phone} className="absolute inset-x-0 top-0">
            <PhoneColumn
              rounds={relay.rounds}
              selected={selected}
              variant="column"
              retired={relay.retired}
            />
          </div>
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
