"use client";

import { ArrowLeft, Presentation } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact } from "@/components/facts";
import { Link } from "@/components/link";
import { GuideText, RelayBasics } from "@/components/live/host-guide";
import { ModelRow } from "@/components/live/model-row";
import { PickControl, usePick } from "@/components/live/pick-control";
import { JoinCode, joinUrl } from "@/components/live/qr-code";
import {
  declinedSentence,
  type RefusalAbout,
  type RefusalWord,
  refusalSentence,
  saidRefusal,
} from "@/components/live/refusals";
import { RoomLine, type SeenOpen, seenOpen } from "@/components/live/room-line";
import { RoundToken } from "@/components/live/round-token";
import {
  afterWallRead,
  choicesOf,
  isPicked,
  lastClosedWall,
  openEntryOf,
  pickedPiles,
  pilesByCount,
  type Relay,
  type RelayRun,
  type RelayRunRound,
  type RelayTake,
  type RoundStanding,
  roundStanding,
  trayOf,
  type Wall as WallShape,
} from "@/components/live/rounds";
import { SortingPanel } from "@/components/live/sorting-panel";
import { Wall, type WallEdits } from "@/components/live/wall";
import { PageContainer } from "@/components/page";
import { SIGN_IN_ENDED } from "@/components/sign-in-ended";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useAdrift } from "@/hooks/use-adrift";
import { useQuery } from "@/hooks/use-query";
import { api, isApiError, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  NO_CONNECTION,
  outOfReach,
  POLL_DEADLINE_MS,
  startPolling,
  withDeadline,
} from "@/lib/poll";
import { cn } from "@/lib/utils";

/** Fast enough that the room sees itself answer, slow enough to be polite. */
const POLL_MS = 3_000;

/** Where the status line stands: out of the flow, above the wall, so nothing moves when it appears or clears. */
const STATUS_LINE =
  "absolute inset-x-0 bottom-full block h-5 text-muted-foreground text-sm sm:text-end";

/** The disabled Open button names the line that says why. */
const REFUSAL_ID = "open-refusal";

/** The Open button names the line that says its source is still being sorted. */
const SORTING_ID = "open-sorting";

/** The Open button names the line that says its round is left opening. */
const OPENING_ID = "open-opening";

/** Every round in the strip sits in the same pill, tapped or not. */
const STRIP_TOKEN = "flex min-w-0 rounded-full px-1 py-0.5";

/** The disc on the primary button takes the button's own colour. */
const ON_PRIMARY =
  "text-current [&>span:first-child]:border-solid [&>span:first-child]:border-current [&>span:first-child]:text-current";

/** A refusal for the state the click asked for, which the screen does not say twice. */
const AS_ASKED = "as-asked";

/** How long a failed ask stands as the word for why nothing is sorting. */
const FAILURE_MS = 60_000;

/** What the panel says when an ask about the shown round made no ask at all. */
const NOTHING_TO_SORT = "Nothing to sort.";

/** How a round stands, in the word its token says out loud. */
const STANDING_WORD: Record<RoundStanding, string> = {
  open: "open",
  done: "closed",
  next: "next",
  plain: "not run",
};

/** A refusal the screen has read: the word, and the round its sentence names. */
interface Refusal {
  word: RefusalWord;
  about: RefusalAbout;
}

/** What a refused request is read as, once the screen has seen the state again. */
type Reading = Refusal | typeof AS_ASKED | null;

type Reader = (error: string) => Reading | Promise<Reading>;

/**
 * The staff screen for a relay run: the rounds, the wall of the round in
 * hand, and the one button that moves the relay on.
 */
export function RelayRunBoard({
  run,
  answeredAt: runAnsweredAt,
  refetch,
  ended = false,
}: {
  run: RelayRun;
  /** When the run was last read, whatever has failed since. */
  answeredAt: number | null;
  refetch: () => void;
  /** The page's sign-in ended: it says so once; the board asks the model nothing. */
  ended?: boolean;
}) {
  const { session } = useAuth();
  /** The one time the board says a send was refused for its sign-in. */
  const saidEnded = useRef(false);
  /** The round the strip was tapped for, under the round that was open then. */
  const [shownLeg, setShownLeg] = useState<{
    leg: string;
    under: string | null;
  } | null>(null);
  const [askedFor, setAskedFor] = useState<string | null>(null);
  /** The round Resort was pressed for and nothing was asked about. */
  const [notAsked, setNotAsked] = useState<string | null>(null);
  /** A move in flight, which takes the buttons out until it lands. */
  const sending = useRef(false);
  const pendingNotes = useRef(new Map<string, Promise<boolean>>());
  const [savingNotes, setSavingNotes] = useState(0);
  const [busy, setBusy] = useState(false);
  /** The button the focus goes to once the move it was on has landed. */
  const focusOn = useRef<"open" | "close" | null>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const { data: relayData, refetch: refetchRelay } = useQuery(
    session
      ? () => api["/live/relays/get"]({ relay: run.relay }).then(unwrap)
      : null,
    [session, run.relay],
    { retainOnTransportError: true },
  );
  const relay = relayData?.relay ?? null;

  const openRound = run.openRound;
  /** The closed rounds whose wall was read to be none, which the screen stops defaulting to. */
  const [wallless, setWallless] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // A tap lapses when the round it was made under gives way to another, so a
  // round that opens takes the screen back.
  const chosen =
    shownLeg === null || shownLeg.under !== openRound
      ? null
      : (run.rounds.find((round) => round.leg === shownLeg.leg)?.round ?? null);
  /** The unrun round the strip was tapped for, which Open then offers instead of the first. */
  const [chosenNext, setChosenNext] = useState<string | null>(null);
  const next = offeredRound(run, chosenNext);
  /** The round left opening, which Open finishes and Close can close. */
  const openingEntry =
    next !== null && next.round !== null && next.round === run.opening
      ? next
      : null;
  const { take, source } = takeOf(run, relay, next);
  /**
   * The wall the round about to open takes from, which is the one in hand
   * while the run is on. A closed run has no next round, so it stands on the
   * round the class ended on instead.
   */
  const taken = run.open ? source?.round : null;
  const shown = chosen ?? openRound ?? taken ?? lastClosedWall(run, wallless);

  const {
    data: wallData,
    error: wallError,
    answeredAt: wallAnsweredAt,
    refetch: refetchWall,
  } = useQuery(
    session && shown !== null
      ? () =>
          api["/live/walls/read"](
            { round: shown },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, shown],
    { retainOnTransportError: true, refreshOn: [openRound] },
  );
  const wall = wallData?.wall ?? null;
  const readWallless = afterWallRead(wallless, shown, wallData);
  if (readWallless !== wallless) setWallless(readWallless);

  // A vote round's rows stand for piles on the wall its choices came from, so
  // the dashboard reads that wall too and each row spreads the cards behind it.
  const shownEntry =
    run.rounds.find((round) => round.round !== null && round.round === shown) ??
    null;
  const shownTake =
    shownEntry === null
      ? null
      : (relay?.rounds.find((one) => one.leg === shownEntry.leg)?.takes[0] ??
        null);
  // A round that takes choices or context reads its source's wall too, so the
  // rows and the carried boxes can say which round they came from.
  const choiceSource =
    shownTake === null || shownTake.use === "parts"
      ? null
      : (run.rounds.find((one) => one.leg === shownTake.source)?.round ?? null);
  const { data: sourceData, refetch: refetchSource } = useQuery(
    session && choiceSource !== null
      ? () =>
          api["/live/walls/read"](
            { round: choiceSource },
            { timeoutMs: POLL_DEADLINE_MS },
          ).then(unwrap)
      : null,
    [session, choiceSource],
    { retainOnTransportError: true },
  );
  const sourceWall: WallShape | null = sourceData?.wall ?? null;

  // Polls and actions refresh these resources without changing their identity.
  // Keep the source cards mounted while their replacements are being read.
  const previousRun = useRef(run);
  useEffect(() => {
    const previous = previousRun.current;
    previousRun.current = run;
    if (previous === run || previous.relay !== run.relay) return;
    refetchRelay();
    refetchSource();
  }, [run, refetchRelay, refetchSource]);

  /** A vote round has nothing to sort: every answer is one of the choices. */
  const voting =
    openRound !== null && wall !== null && choicesOf(wall).length > 0;

  // The button that acted is replaced by the next move, so the focus goes to
  // the one that took its place rather than to the top of the page.
  useEffect(() => {
    const goes = focusOn.current;
    if (goes === null) return;
    focusOn.current = null;
    (goes === "open" ? openButton : closeButton).current?.focus();
  }, [openRound]);

  useEffect(() => {
    if (!run.open) return;
    const timer = setInterval(refetch, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, refetch]);

  // The close sends one last placing ask, so the wall is read until that
  // ask has landed and nothing is out, closed or not.
  const settling = wall?.sortPending === true || (wall?.asksOut ?? 0) > 0;

  // A frozen figure reads like a quiet room, so the wall says when it has
  // stopped hearing: the last answer to the run's or the wall's poll is ten
  // seconds old. The clock the line is read against lives as long as the
  // polling, and a fresh failure of the model is read against it too.
  const { adrift: stale, now } = useAdrift(
    [
      { answeredAt: runAnsweredAt, polling: run.open },
      { answeredAt: wallAnsweredAt, polling: run.open || settling },
    ],
    POLL_MS,
  );
  const adrift = !ended && stale;
  /** The open round, and when the read that first showed it open landed. */
  const [openSeen, setOpenSeen] = useState<SeenOpen | null>(null);
  const seen = seenOpen(openSeen, openRound, runAnsweredAt ?? now);
  if (seen !== openSeen) setOpenSeen(seen);

  useEffect(() => {
    if (!run.open && !settling) return;
    const timer = setInterval(refetchWall, POLL_MS);
    return () => clearInterval(timer);
  }, [run.open, settling, refetchWall]);

  useEffect(() => {
    if (!run.modelSorts || openRound === null || voting || ended) return;
    return startPolling(
      async () => {
        const answer = await api["/live/walls/sort"](
          { round: openRound },
          { timeoutMs: POLL_DEADLINE_MS },
        );
        if (outOfReach(answer)) return false;
        if (!isApiError(answer) && answer.asked) {
          setAskedFor(openRound);
          setNotAsked(null);
        }
        return true;
      },
      { everyMs: POLL_MS },
    );
  }, [run.modelSorts, openRound, voting, ended]);

  const openEntry = openEntryOf(run);
  const [tapped, setTapped] = useState<{
    round: string;
    piles: string[];
  } | null>(null);
  /** A pick still in flight, whose taps stand until the wall they wrote arrives. */
  const picking = useRef(false);
  /** The set asked for while a pick was in flight, sent when it lands. */
  const queuedPick = useRef<string[] | null>(null);

  useEffect(() => {
    if (picking.current) return;
    setTapped(null);
  }, [wall]);

  // A pick lands on the shown wall at once, the way a hand edit does, so the
  // panel's count and the piles' outlines are one reading.
  const shownWall = useMemo(
    () =>
      wall === null || tapped === null || tapped.round !== wall.round
        ? wall
        : withPicks(wall, tapped.piles),
    [wall, tapped],
  );
  /** The shown wall once it is the round asked for, and not the one before it. */
  const inHand =
    shownWall !== null && shownWall.round === shown ? shownWall : null;
  const picks = inHand === null ? [] : pickedPiles(inHand);
  const takesShown =
    take !== null &&
    source !== null &&
    source.round === shown &&
    roundStanding(run, source) === "done";
  /**
   * The round the shown wall's picks carry into: the one about to take them
   * while the run is on, and afterwards the one that took them, so a pick
   * stands as history on a wall looked at again.
   */
  const carriesTo =
    takesShown && run.open
      ? (next?.number ?? undefined)
      : (drawerOf(run, relay, shownEntry)?.number ?? undefined);

  /**
   * Sends the difference between the picked set on the screen and the one
   * wanted, one request per pile, in the order wanted; the wanted set stands
   * on the screen until the wall lands.
   */
  function applyPick(piles: string[]) {
    if (shown === null) return;
    const round = shown;
    setTapped({ round, piles });
    // One sequence at a time: a change made while one is in flight waits,
    // and is sent against the set that sequence leaves, not the one it began
    // from — two sequences over one wall would unpick each other's piles.
    if (picking.current) {
      queuedPick.current = piles;
      return;
    }
    picking.current = true;
    void sequencePick(round, picks, piles);
  }

  async function sequencePick(
    round: string,
    before: string[],
    piles: string[],
  ) {
    for (const pile of before) {
      if (piles.includes(pile)) continue;
      if (
        !(await send(
          api["/live/walls/unpick"]({ round, pile }),
          goneOrClosed("PILE_GONE"),
        ))
      )
        break;
    }
    for (const pile of piles) {
      if (before.includes(pile)) continue;
      if (
        !(await send(
          api["/live/walls/pick"]({ round, pile }),
          goneOrClosed("PILE_GONE"),
        ))
      )
        break;
    }
    const next = queuedPick.current;
    queuedPick.current = null;
    if (next !== null) {
      await sequencePick(round, piles, next);
      return;
    }
    picking.current = false;
    refetchWall();
  }

  const pick = usePick({
    run: run.run,
    round: inHand?.round ?? null,
    piles: inHand?.piles ?? [],
    picked: picks,
    live: takesShown && run.open && inHand !== null,
    onPick: applyPick,
  });

  /** Sends one request; a refusal is said in the word the screen reads for it. */
  async function send(request: Promise<unknown>, read: Reader) {
    const result = await withDeadline(request);
    if (!isApiError(result)) return true;
    // A sign-in that ended is said once by the page, with the way back in,
    // and once here for the move that did not land; the poll learns it on
    // the next read, so it is asked for now.
    if (result.error === "UNAUTHORIZED") {
      if (!saidEnded.current) {
        saidEnded.current = true;
        toast.error(SIGN_IN_ENDED);
      }
      refetch();
      return false;
    }
    const reading = await read(result.error);
    // A move that did not take leaves the screen ahead of the server, whether
    // it was refused or the edge dropped it: a Close that landed late still
    // has to show closed.
    refetch();
    if (reading === AS_ASKED) return false;
    toast.error(
      saidRefusal(result.error, reading?.word ?? null, reading?.about),
    );
    return false;
  }

  /**
   * One move at a time: the second click of a doubled click is the same
   * intent, so the button is out while the first is in flight.
   */
  async function move(work: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  /** The run as it now stands, so a refusal is said from what is true. */
  async function freshRun(): Promise<RelayRun | null> {
    const answer = await api["/live/relays/run"]({ run: run.run });
    refetch();
    return isApiError(answer) ? null : answer.run;
  }

  /** A refused wall edit: the pile or card is gone, or the run has closed. */
  function goneOrClosed(gone: "PILE_GONE" | "CARD_GONE"): Reader {
    return async (error) => {
      if (error === "NOT_FOUND") return { word: gone, about: {} };
      if (error !== "CONFLICT") return null;
      const fresh = await freshRun();
      return fresh !== null && !fresh.open
        ? { word: "CLOSED", about: {} }
        : null;
    };
  }

  /** A refused move on the run: the run has closed under the button. */
  const closedRun: Reader = async () => {
    const fresh = await freshRun();
    return fresh !== null && !fresh.open ? { word: "CLOSED", about: {} } : null;
  };

  const edits: WallEdits | undefined =
    shown === null
      ? undefined
      : {
          moveCard: (card, pile) => {
            void send(
              api["/live/walls/move-card"]({ card, pile }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          toTray: (card) => {
            void send(
              api["/live/walls/to-tray"]({ card }),
              goneOrClosed("CARD_GONE"),
            ).then(refetchWall);
          },
          openPile: (card, name) => {
            void send(
              api["/live/walls/open-pile"](
                card === null
                  ? { round: shown, name }
                  : { round: shown, name, card },
              ),
              goneOrClosed("CARD_GONE"),
            ).then(refetchWall);
          },
          renamePile: (pile, name) => {
            void send(
              api["/live/walls/rename-pile"]({ pile, name }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          mergePile: (pile, into) => {
            void send(
              api["/live/walls/merge-pile"]({ pile, into }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          removeCard: (card) => {
            void send(
              api["/live/walls/remove-card"]({ round: shown, card }),
              goneOrClosed("CARD_GONE"),
            ).then(refetchWall);
          },
          summarize: (pile) => {
            void send(
              api["/live/walls/summarize"]({ pile }),
              goneOrClosed("PILE_GONE"),
            ).then((sent) => {
              if (sent) toast.success("Summarizing…");
            });
          },
          describePile: (pile, description) => {
            void send(
              api["/live/walls/describe-pile"]({ pile, description }),
              goneOrClosed("PILE_GONE"),
            ).then(refetchWall);
          },
          togglePick:
            takesShown && run.open && inHand !== null ? pick.tap : undefined,
          /**
           * A choice nobody chose has no pile to pin: the empty pile of that
           * name is opened first, and the tap then carries what it opened.
           */
          pickChoice:
            takesShown && run.open && inHand !== null
              ? (name) => {
                  const opening = api["/live/walls/open-choice"]({
                    round: shown,
                    name,
                  });
                  void send(opening, goneOrClosed("PILE_GONE")).then(
                    async (sent) => {
                      if (!sent) return;
                      const opened = await opening;
                      if (!isApiError(opened)) pick.tap(opened.pile);
                    },
                  );
                }
              : undefined,
        };

  /**
   * The piles the round about to open takes, in the order the closed wall
   * shows them. A wall not in hand is read for them first.
   */
  async function picksToSend(): Promise<string[] | { error: string }> {
    if (take === null || source === null || source.round === null) return [];
    if (counted) return shownPicks(inHand);
    const read = await withDeadline(
      api["/live/walls/read"](
        { round: source.round },
        { timeoutMs: POLL_DEADLINE_MS },
      ),
    );
    if (isApiError(read)) return read;
    return read.wall === null ? [] : shownPicks(read.wall);
  }

  async function openNext() {
    if (next === null || refusal !== null) return;
    const leg = next.leg;
    const picked = await picksToSend();
    if (!Array.isArray(picked)) {
      await send(Promise.resolve(picked), () => null);
      return;
    }
    const opening = api["/live/relays/open-round"]({
      run: run.run,
      leg,
      picked,
    });
    // Two presses that pass the server's reads together meet at the round
    // itself, and the loser hears only the category: the run then says
    // which round stands.
    const answered = await send(opening, async (error) => {
      if (error !== "CONFLICT") return null;
      const fresh = await freshRun();
      return fresh === null ? null : standingAfterRace(fresh, leg);
    });
    if (!answered) return;
    const answer = await opening;
    if (isApiError(answer)) return;
    refetch();
    if ("declined" in answer) {
      toast.error(declinedSentence(answer));
      return;
    }
    focusOn.current = "close";
  }

  async function closeRound(round: string, number: number) {
    const shut = await send(
      api["/live/relays/close-round"]({ round }),
      async (error) =>
        standingAfterClose(error, await freshRun(), round, number),
    );
    if (shut) focusOn.current = "open";
    refetch();
  }

  async function closeRun() {
    await send(api["/live/relays/close"]({ run: run.run }), async () => {
      // Already closed is what the click asked for; anything else is a
      // failure the lecturer has to see.
      const fresh = await freshRun();
      return fresh !== null && !fresh.open ? AS_ASKED : null;
    });
    refetch();
  }

  async function sortsChange(on: boolean) {
    if (
      on &&
      sortingRound !== null &&
      (await pendingNotes.current.get(sortingRound.round)) === false
    )
      return;
    if (!on) setAskedFor(null);
    await send(
      on
        ? api["/live/relays/sort-by-model"]({ run: run.run })
        : api["/live/relays/sort-by-hand"]({ run: run.run }),
      closedRun,
    );
    refetch();
  }

  /**
   * One deliberate ask about the shown round, which Resort makes once the
   * piles are empty. An ask that finds cards in the tray and nothing to ask
   * has found an ask already out, and reads as that ask's.
   */
  async function sortNow(round: string, held: number) {
    const asking = api["/live/walls/sort-now"]({ round });
    if (!(await send(asking, closedRun))) return;
    const answer = await asking;
    if (isApiError(answer)) return;
    const out = answer.asked || held > 0;
    if (out) setAskedFor(round);
    setNotAsked(out ? null : round);
  }

  /** Every card of the shown round back to the tray, the piles standing. */
  async function emptyPiles(round: string) {
    const emptied = await send(
      api["/live/walls/empty-piles"]({ round }),
      closedRun,
    );
    if (emptied) {
      setNotAsked(null);
      refetchWall();
    }
    return emptied;
  }

  async function resort(round: string, held: number) {
    if (await emptyPiles(round)) await sortNow(round, held);
  }

  /** The run's note to whoever sorts the shown round: written when it has a body, gone when it does not. */
  async function writeNotes(round: string, body: string) {
    const written = await send(
      body === ""
        ? api["/live/walls/clear-notes"]({ round })
        : api["/live/walls/set-notes"]({ round, body }),
      closedRun,
    );
    if (written) refetchWall();
    return written;
  }

  async function invite(seats: number) {
    const standing = run.seats.length;
    for (let seat = 0; seat < seats; seat += 1) {
      const taken = await send(
        api["/live/runs/invite"]({
          run: run.run,
          device: seatIdentity(standing + seat + 1),
        }),
        closedRun,
      );
      if (!taken) break;
    }
    refetch();
    refetchWall();
  }

  async function dismiss() {
    const seat = run.seats.at(-1);
    if (seat === undefined) return;
    await send(
      api["/live/runs/dismiss"]({
        run: run.run,
        participant: seat.participant,
      }),
      closedRun,
    );
    refetch();
  }

  async function dismissAll() {
    const asked = run.seats.length;
    let gone = 0;
    for (const seat of run.seats) {
      const dismissed = await send(
        api["/live/runs/dismiss"]({
          run: run.run,
          participant: seat.participant,
        }),
        closedRun,
      );
      if (!dismissed) break;
      gone += 1;
    }
    // One seat is one request, so a row that stops short says how far it got.
    if (gone < asked) toast(`Dismissed ${gone} of ${asked} seats.`);
    refetch();
  }

  /** Seats whose ask failed with no reply after: not writing, and said so. */
  const silentSeats =
    openEntry === null ? 0 : (openEntry.figure.silentByModel ?? 0);
  const writing =
    openEntry === null
      ? 0
      : Math.max(
          0,
          run.seats.length -
            (openEntry.figure.handedInByModel ?? 0) -
            silentSeats,
        );
  /** What the shown wall holds, which is what there is to ask about. */
  const tray = inHand === null ? [] : trayOf(inHand.cards);
  const piled = inHand === null ? 0 : inHand.cards.length - tray.length;
  const sorting = shown !== null && askedFor === shown && tray.length > 0;
  /** The model's last try at this round failed, so nothing is coming while it is asked. */
  const silent = modelSilent(inHand, now);
  const modelWord =
    inHand === null
      ? null
      : sortingWord({
          open: inHand.open,
          asksOut: inHand.asksOut,
          sortPending: inHand.sortPending,
          modelSorts: run.modelSorts,
          sorting,
          silent,
          notAsked: notAsked === shown,
        });
  /** The shown round with the relay's note, which the editor writes, and the run's, which the panel writes. */
  const sortingRound =
    shownEntry === null || shown === null
      ? null
      : {
          round: shown,
          relay: run.relay,
          relayNotes:
            relay?.rounds.find((one) => one.leg === shownEntry.leg)?.notes ??
            "",
          notes: inHand?.notes ?? "",
        };
  /** Nothing is left to open, so the seats have nothing to act on; a shown wall can still be sorted. */
  const everyRoundRan = run.open && openRound === null && next === null;

  /** The pick counts for the round about to open only once its wall is read. */
  const counted = takesShown && inHand !== null;
  const refusal = openReadiness({
    open: run.open,
    openRound: openEntry?.number ?? null,
    source:
      source === null
        ? null
        : {
            number: source.number,
            ran: roundStanding(run, source) !== "next",
          },
    piles: counted ? inHand.piles.length : null,
    picks: counted ? picks.length : null,
  });
  const openRefused = refusal !== null;
  /** Open is the run's own move only while nothing else is in hand. */
  const openPrimary = openEntry === null && !openRefused;
  /** The wall the round about to open takes from, while its cards are still being placed. */
  const sortLine =
    counted && source !== null
      ? stillSorting({
          round: source.number,
          unplaced: tray.length,
          pending: inHand.asksOut > 0 || inHand.sortPending,
        })
      : null;
  const refusalLine = printedRefusal(refusal, sortLine !== null);
  const openDescribed =
    [
      refusalLine === null ? null : REFUSAL_ID,
      sortLine === null ? null : SORTING_ID,
      openingEntry === null ? null : OPENING_ID,
    ]
      .filter((id) => id !== null)
      .join(" ") || undefined;

  /** The shown wall is a vote round's, which has nothing to sort. */
  const shownVotes = inHand !== null && choicesOf(inHand).length > 0;
  const place = wallPlace({
    shown:
      shown === null
        ? null
        : {
            number: shownEntry?.number ?? null,
            closed:
              shownEntry !== null && roundStanding(run, shownEntry) === "done",
          },
    none: wallData !== null && wallData.wall === null,
    opening: run.opening !== null,
  });
  const panel = (
    <SortingPanel
      modelSorts={run.modelSorts}
      word={savingNotes > 0 ? "Saving instructions…" : modelWord}
      round={sortingRound}
      canSweep={piled > 0}
      busy={busy}
      closed={!run.open}
      onSorts={(on) => void sortsChange(on)}
      onSweep={() => {
        if (shown === null) return;
        void move(async () => {
          if ((await pendingNotes.current.get(shown)) === false) return;
          if (run.modelSorts) await resort(shown, inHand?.cards.length ?? 0);
          else await emptyPiles(shown);
        });
      }}
      canClearEmpty={
        inHand !== null &&
        inHand.asksOut === 0 &&
        inHand.piles.some((pile) => pile.count === 0 && pile.picked === null)
      }
      onClearEmpty={() => {
        if (shown === null) return;
        void move(async () => {
          if (
            await send(
              api["/live/walls/clear-empty-piles"]({ round: shown }),
              closedRun,
            )
          )
            refetchWall();
        });
      }}
      onNotes={(body) => {
        if (sortingRound === null) return;
        const round = sortingRound.round;
        const prior = pendingNotes.current.get(round);
        setSavingNotes((count) => count + 1);
        const save = (async () => {
          try {
            await prior;
            return await writeNotes(round, body);
          } finally {
            setSavingNotes((count) => count - 1);
          }
        })();
        pendingNotes.current.set(round, save);
      }}
    />
  );

  return (
    <PageContainer width="wide" className="max-w-[1520px]">
      <header className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Link
            href="/staff/live"
            className="eyebrow inline-flex items-center gap-1 hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Live
          </Link>
          <h1
            dir="auto"
            className="text-balance font-display font-semibold text-[40px] leading-tight tracking-tight"
          >
            {run.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Fact.Status status={run.open ? "OPEN" : "CLOSED"} />
            <Fact.Range
              verb={run.closedAt === null ? undefined : "Opened"}
              from={run.openedAt}
              to={run.closedAt}
              className="text-muted-foreground text-sm"
            />
          </div>
          <div className="-mx-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {run.rounds.map((round) => {
              // A closed run has no next round, so one that never ran is only
              // written.
              const ran = roundStanding(run, round);
              const standing = ran === "next" && !run.open ? "plain" : ran;
              const token = (
                <RoundToken
                  number={round.number}
                  title={round.title}
                  standing={standing}
                  size="md"
                />
              );
              // A closed round's token shows its wall; the open round's takes
              // the screen back to it; an unrun round's is what Open offers.
              const name = tokenName(round, standing);
              if (standing === "done" || standing === "open") {
                const pressed = round.round === shown;
                return (
                  <button
                    key={round.leg}
                    type="button"
                    aria-label={name}
                    aria-pressed={pressed}
                    onClick={() =>
                      setShownLeg(
                        standing === "open"
                          ? null
                          : { leg: round.leg, under: openRound },
                      )
                    }
                    className={cn(
                      STRIP_TOKEN,
                      pressed && "ring-1 ring-primary/60",
                    )}
                  >
                    {token}
                  </button>
                );
              }
              // Pressed says one thing only — this wall is shown — so the
              // round Open offers says so in its name and its dashed ring.
              const offered = run.open && round.leg === next?.leg;
              return run.open ? (
                <button
                  key={round.leg}
                  type="button"
                  aria-label={name}
                  onClick={() => setChosenNext(round.leg)}
                  className={cn(
                    STRIP_TOKEN,
                    offered && "ring-1 ring-foreground/35 ring-dashed",
                  )}
                >
                  {token}
                </button>
              ) : (
                <span key={round.leg} className={STRIP_TOKEN}>
                  {token}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/staff/live/run/${run.run}/project`} target="_blank">
              <Presentation /> Project
            </Link>
          </Button>
          {run.open ? (
            <ConfirmAction
              trigger={<Button variant="destructive">Close run</Button>}
              title="Close this run?"
              description="Nobody can join or hand in after this."
              confirmLabel="Close run"
              destructive
              onConfirm={closeRun}
            />
          ) : null}
        </div>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-1">
        <GuideText guide={run.hostGuide} detail="Relay" />
        <RelayBasics />
        {shownEntry === null ? (
          next === null ? null : (
            <GuideText
              detail="Round"
              guide={next.hostGuide}
              title={`Running round ${next.number}`}
            />
          )
        ) : (
          <GuideText
            detail="Round"
            guide={shownEntry.hostGuide}
            title={`Running round ${shownEntry.number}`}
          />
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          {/* Beside the figure, which is the number that has stopped moving. */}
          <p role="status" className={STATUS_LINE}>
            {adrift ? NO_CONNECTION : null}
          </p>
          {shownWall === null ? (
            wallError !== null ? (
              <ErrorState message={wallError} onRetry={refetchWall} />
            ) : place === READING_WALL ? (
              <LoadingState label="Loading the wall…" />
            ) : (
              <p className="flex min-h-40 items-center justify-center rounded-2xl border border-border border-dashed bg-card/40 px-7 py-16 text-center text-muted-foreground">
                {place}
              </p>
            )
          ) : (
            <Wall
              wall={shownWall}
              named={run.open && shown !== openRound}
              carriesTo={carriesTo}
              sourceWall={sourceWall}
              edits={run.open ? edits : undefined}
            />
          )}
        </div>

        {/* The run's moves stand before the wall on a narrow screen, so
            closing a round is never a scroll past every pile; the join card
            follows the wall, which is what the screen is for. Below `lg` the
            column is no box at all, so its panels sort against the wall. */}
        <aside className="contents lg:sticky lg:top-6 lg:order-2 lg:flex lg:flex-col lg:gap-4">
          {!run.open ? (
            <div className="order-1 flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
              <p className="text-muted-foreground text-sm">
                {refusalSentence("CLOSED")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                asChild
              >
                <Link href={`/staff/live/relay/${run.relay}`}>
                  <ArrowLeft /> Back to the relay
                </Link>
              </Button>
              <PileGuidance piles={inHand?.piles ?? []} />
              {sortingRound === null || shownVotes ? null : (
                <>
                  <div className="h-px bg-border" />
                  {panel}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="order-1 flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
                <RoomLine
                  room={run.room}
                  round={openEntry?.number ?? null}
                  waited={seen === null ? 0 : now - seen.at}
                />
                {openEntry === null ? null : (
                  <Button
                    ref={closeButton}
                    size="lg"
                    className="w-full justify-start gap-2 pr-3.5 pl-4"
                    aria-disabled={busy}
                    onClick={() => {
                      if (busy || openRound === null) return;
                      void move(() => closeRound(openRound, openEntry.number));
                    }}
                  >
                    Close
                    <RoundToken
                      number={openEntry.number}
                      title={openEntry.title}
                      standing="open"
                      size="sm"
                      className={ON_PRIMARY}
                    />
                  </Button>
                )}
                {next === null || openEntry !== null ? null : (
                  <>
                    {takesShown && source?.hostGuide.selection ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">
                          Host selection advice
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {source.hostGuide.selection}
                        </p>
                      </details>
                    ) : null}
                    {takesShown ? (
                      <PickControl
                        mode={pick.mode}
                        top={pick.top}
                        piles={inHand?.piles ?? []}
                        onMode={pick.setMode}
                        onTop={pick.setTop}
                      />
                    ) : null}
                    {/* Refused, the button keeps its focus and its words: it
                        is out by aria, not greyed past reading. */}
                    <Button
                      ref={openButton}
                      variant={openPrimary ? "default" : "outline"}
                      size="lg"
                      className={cn(
                        "w-full justify-between gap-3 pr-3.5 pl-4",
                        openRefused &&
                          "cursor-default text-muted-foreground hover:bg-background hover:text-muted-foreground dark:hover:bg-input/30",
                      )}
                      aria-disabled={openRefused || busy}
                      title={refusalLine ?? undefined}
                      aria-describedby={openDescribed}
                      onClick={() => {
                        if (openRefused || busy) return;
                        void move(openNext);
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        Open
                        <RoundToken
                          number={next.number}
                          title={next.title}
                          standing="next"
                          size="sm"
                          className={openPrimary ? ON_PRIMARY : undefined}
                        />
                      </span>
                      {counted ? (
                        <span
                          className={cn(
                            "flex-none font-mono text-xs",
                            !openRefused && "opacity-80",
                          )}
                        >
                          {picks.length} {picks.length === 1 ? "pile" : "piles"}
                        </span>
                      ) : null}
                    </Button>
                    {refusalLine === null ? null : (
                      <p
                        id={REFUSAL_ID}
                        className="text-muted-foreground text-xs"
                      >
                        {refusalLine}
                      </p>
                    )}
                    {sortLine === null ? null : (
                      <p
                        id={SORTING_ID}
                        className="text-muted-foreground text-xs"
                      >
                        {sortLine}
                      </p>
                    )}
                    {openingEntry === null ? null : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p
                          id={OPENING_ID}
                          className="text-muted-foreground text-xs"
                        >
                          Round {openingEntry.number} is opening.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-disabled={busy}
                          onClick={() => {
                            if (busy || openingEntry.round === null) return;
                            const round = openingEntry.round;
                            void move(() =>
                              closeRound(round, openingEntry.number),
                            );
                          }}
                        >
                          Close round {openingEntry.number}
                        </Button>
                      </div>
                    )}
                  </>
                )}
                {everyRoundRan ? (
                  <p className="text-muted-foreground text-xs">
                    {refusalSentence("ROUNDS_RUN")}
                  </p>
                ) : null}
              </div>
              <div className="order-3 flex flex-col gap-3.5 rounded-xl border border-border bg-card p-5">
                <PileGuidance piles={inHand?.piles ?? []} />
                {voting || (everyRoundRan && inHand === null) ? null : (
                  <>
                    {panel}
                    <div className="h-px bg-border" />
                  </>
                )}
                {everyRoundRan ? null : (
                  <details className="min-w-0">
                    <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
                      AI participants
                    </summary>
                    <div className="pt-3">
                      <ModelRow
                        count={run.seats.length}
                        writing={writing}
                        silent={silentSeats}
                        onInvite={invite}
                        onDismiss={dismiss}
                        onDismissAll={dismissAll}
                      />
                    </div>
                  </details>
                )}
              </div>

              {run.token === null || run.code === null ? null : (
                <div className="order-4 rounded-xl border border-border bg-card p-4">
                  <JoinCode url={joinUrl(run.token)} code={run.code} />
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}

/** The wall as the screen has it: the piles this page just picked read picked. */
function withPicks(wall: WallShape, piles: string[]): WallShape {
  return {
    ...wall,
    piles: wall.piles.map((pile) => ({
      ...pile,
      picked: piles.includes(pile.pile) ? (pile.picked ?? pile.pile) : null,
    })),
  };
}

/**
 * What the panel says the model is doing about the shown round, read from the
 * wall rather than from a clock of the screen's own.
 */
export function sortingWord({
  open,
  asksOut,
  sortPending,
  modelSorts,
  sorting,
  silent,
  notAsked,
}: {
  /** The shown round is open, so the tick is still asking about it. */
  open: boolean;
  /** Asks about the shown round the server has not answered yet. */
  asksOut: number;
  /** The server holds the sort through its consequential placements. */
  sortPending: boolean;
  modelSorts: boolean;
  /** The screen made an ask about the shown round and cards are still in the tray. */
  sorting: boolean;
  /** The model's last try at this round failed moments ago. */
  silent: boolean;
  /** Resort asked about this round and there was nothing to ask. */
  notAsked: boolean;
}): string | null {
  const pending = asksOut > 0 || sortPending || sorting;
  if (pending && !modelSorts)
    return "Finishing current sort; automatic sorting is off.";
  // With the switch off the host has taken the wall by hand, and the word
  // would only say what they already know.
  if (silent && modelSorts) return "The model is not answering.";
  if (pending) return open ? "sorting…" : "settling…";
  if (!open) return "Settled";
  return notAsked ? NOTHING_TO_SORT : null;
}

/** The seat's own name, which carries its place in the order the seats were taken. */
export function seatIdentity(ordinal: number): string {
  return `seat-${ordinal}-${crypto.randomUUID()}`;
}

/**
 * Whether the model's last try at this round failed just now, which is why
 * nothing is sorting. An older failure is history: the room has moved on.
 */
export function modelSilent(
  wall: { failure: string | null; failedAt: string | null } | null,
  now: number,
): boolean {
  if (wall === null || wall.failure === null || wall.failedAt === null)
    return false;
  const at = Date.parse(wall.failedAt);
  return Number.isFinite(at) && Math.abs(now - at) < FAILURE_MS;
}

/** What a round in the strip is called: the round, its title, and how it stands. */
export function tokenName(
  round: { number: number; title: string },
  standing: RoundStanding,
): string {
  return [`Round ${round.number}`, round.title.trim(), STANDING_WORD[standing]]
    .filter((part) => part !== "")
    .join(", ");
}

/**
 * The round Open offers: the one left opening, else the unrun round the strip
 * was tapped for, else the first unrun.
 */
export function offeredRound(
  run: Pick<RelayRun, "openRound" | "opening" | "rounds">,
  chosen: string | null,
): RelayRunRound | null {
  const opening =
    run.opening === null
      ? undefined
      : run.rounds.find((round) => round.round === run.opening);
  const unrun = run.rounds.filter(
    (round) => roundStanding(run, round) === "next",
  );
  return (
    opening ?? unrun.find((round) => round.leg === chosen) ?? unrun[0] ?? null
  );
}

/** What a round takes from an earlier one, and how that source stands in this run. */
function takeOf(
  run: RelayRun,
  relay: Relay | null,
  round: RelayRunRound | null,
): { take: RelayTake | null; source: RelayRunRound | null } {
  const take =
    round === null
      ? null
      : (relay?.rounds.find((one) => one.leg === round.leg)?.takes[0] ?? null);
  const source =
    take === null
      ? null
      : (run.rounds.find((one) => one.leg === take.source) ?? null);
  return { take, source };
}

/** The round that took from this one and has run, whose disc a picked pile keeps. */
function drawerOf(
  run: RelayRun,
  relay: Relay | null,
  round: RelayRunRound | null,
): RelayRunRound | null {
  if (round === null || relay === null) return null;
  return (
    run.rounds.find(
      (one) =>
        one.round !== null &&
        relay.rounds.find((written) => written.leg === one.leg)?.takes[0]
          ?.source === round.leg,
    ) ?? null
  );
}

/**
 * Why Open is out before it is pressed, from what the screen already holds:
 * the run, the round open, the round it takes from, and that round's wall.
 */
export function openReadiness({
  open,
  openRound,
  source,
  piles,
  picks,
}: {
  /** The run is open. */
  open: boolean;
  /** The number of the round open to the room, if one is. */
  openRound: number | null;
  /** The round the one about to open takes from, and whether it ran in this run. */
  source: { number: number; ran: boolean } | null;
  /** How many piles stand on the wall the round takes from, once it is read. */
  piles: number | null;
  picks: number | null;
}): Refusal | null {
  if (!open) return { word: "CLOSED", about: {} };
  if (openRound !== null)
    return { word: "ROUND_OPEN", about: { round: openRound } };
  if (source === null) return null;
  if (!source.ran)
    return { word: "SOURCE_UNRUN", about: { source: source.number } };
  // Nothing to pick and nothing picked are two different moves: sort first,
  // or tap a pile.
  if (piles === 0) return { word: "NO_PILES", about: {} };
  if (picks === 0) return { word: "NOTHING_PICKED", about: {} };
  return null;
}

/**
 * Why Open is out, printed only when nothing else on screen says it: the Close
 * button says a round is open, and while the wall it takes from is still being
 * sorted, the sorting line is why no pile stands or is picked yet.
 */
export function printedRefusal(
  refusal: Refusal | null,
  sorting: boolean,
): string | null {
  if (refusal === null || refusal.word === "ROUND_OPEN") return null;
  if (
    sorting &&
    (refusal.word === "NO_PILES" || refusal.word === "NOTHING_PICKED")
  )
    return null;
  return refusalSentence(refusal.word, refusal.about);
}

/** What the Open line says while the wall a round takes from is still being sorted. */
export function stillSorting({
  round,
  unplaced,
  pending,
}: {
  round: number;
  /** Cards on that wall not on a pile yet. */
  unplaced: number;
  /** An ask about that wall is still out. */
  pending: boolean;
}): string | null {
  if (!pending || unplaced === 0) return null;
  const cards = unplaced === 1 ? "1 card is" : `${unplaced} cards are`;
  return `Round ${round} is still being sorted: ${cards} not on a pile yet.`;
}

/** The picked piles in the order the closed wall shows them. */
export function shownPicks(wall: Pick<WallShape, "piles">): string[] {
  return pilesByCount(wall.piles.filter(isPicked)).map((pile) => pile.pile);
}

/**
 * What a press of Open that lost a race says, from the run read after it: the
 * run closed, the round asked for stands or already ran, or another round is
 * open or opening. Anything else is said as the category.
 */
export function standingAfterRace(
  run: Pick<RelayRun, "open" | "openRound" | "opening" | "rounds">,
  leg: string,
): Refusal | typeof AS_ASKED | null {
  if (!run.open) return { word: "CLOSED", about: {} };
  const asked = run.rounds.find((round) => round.leg === leg) ?? null;
  if (asked?.round != null) {
    if (asked.round === run.openRound || asked.round === run.opening)
      return AS_ASKED;
    if (roundStanding(run, asked) === "done")
      return { word: "ROUND_DONE", about: { round: asked.number } };
  }
  const standing = run.openRound ?? run.opening;
  const other =
    standing === null
      ? null
      : (run.rounds.find((round) => round.round === standing) ?? null);
  return other === null
    ? null
    : { word: "ROUND_OPEN", about: { round: other.number } };
}

/**
 * What a press of Close round that did not land says, from the run read after
 * it: nothing more once the round has closed as asked, and the failure's own
 * sentence while the round is still open or opening, which leaves Close
 * offered. The round is said closed only when the server refused to close a
 * round already closed and the run read cannot show it.
 */
export function standingAfterClose(
  error: string,
  run: Pick<RelayRun, "open" | "openRound" | "opening" | "rounds"> | null,
  round: string,
  number: number,
): Refusal | typeof AS_ASKED | null {
  if (run !== null && !run.open) return { word: "CLOSED", about: {} };
  const asked = run?.rounds.find((one) => one.round === round) ?? null;
  if (asked?.figure.open === false) return AS_ASKED;
  const stillOpen =
    asked !== null || run?.openRound === round || run?.opening === round;
  if (stillOpen || error !== "CONFLICT") return null;
  return { word: "ROUND_CLOSED", about: { round: number } };
}

/** The wall's place while the wall asked for is still being read. */
export const READING_WALL = "reading";

/**
 * What stands in the wall's place when there is no wall to show: the round
 * asked for, when it closed before it opened; the wall, while it is still
 * being read; and with no round asked for, that none has opened, unless one
 * is opening, which the Open line already says.
 */
export function wallPlace({
  shown,
  none,
  opening,
}: {
  /** The round whose wall is asked for: its number, and whether it has closed. */
  shown: { number: number | null; closed: boolean } | null;
  /** The read of that wall answered that there is none. */
  none: boolean;
  /** A round of the run is opening. */
  opening: boolean;
}): string | typeof READING_WALL | null {
  if (shown === null) return opening ? null : "No round has opened yet.";
  if (none && shown.closed && shown.number !== null)
    return `Round ${shown.number} closed before it opened.`;
  return READING_WALL;
}

function PileGuidance({ piles }: { piles: WallShape["piles"] }) {
  return piles.some((pile) => pile.definition || pile.legacyText) ? (
    <details className="min-w-0">
      <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
        Pile guidance
      </summary>
      <div className="space-y-3 pt-2">
        {piles
          .filter((pile) => pile.definition || pile.legacyText)
          .map((pile) => (
            <div key={pile.pile}>
              <p className="text-sm font-medium">{pile.name}</p>
              {pile.definition ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {pile.definition}
                </p>
              ) : null}
              {pile.legacyText ? (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Existing pile text (review)
                  </summary>
                  <p className="mt-1 whitespace-pre-wrap">{pile.legacyText}</p>
                  <p className="mt-1">
                    Preserved from an older run. Its original role is uncertain;
                    it is not shown as a result summary.
                  </p>
                </details>
              ) : null}
            </div>
          ))}
      </div>
    </details>
  ) : null;
}
