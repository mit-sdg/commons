# The wall

A round's wall is every answer the room handed in, as cards, sorted into named piles with counts. A card is one value of one part of one response; its identity is minted from the response and the item and reveals neither. Piles are Categorizing categories whose scope is the round's edition, so an answer has at most one home, a pile's name is unique on its wall, and two walls may each have a pile called `add`. Cards with no home are the tray. A vote's ballots sort themselves: [Live.walls.HandedInBallotsJoinTheirPiles](reaction:Live.walls.HandedInBallotsJoinTheirPiles) files each handed-in answer that is one of the round's choices — [answerKind](computation:answerKind) — under the pile of that name, so a vote wall is piles like any other, its bars read them, and its groups can be picked and carried like a written round's. Every staff endpoint here requires `live:host`, and every write is refused `CLOSED` once the round's run has closed, while a closed round of an open run still takes picks and hand sorting, which is when staff pick.

[Live.walls.Read](reaction:Live.walls.Read) forms [the wall of one round](former:Live.walls.theWall): the round's number, title, prompt, and parts; whether it is open; the run's note to the sorter; how many responses were begun and handed in, and how many of each the model's seats account for, so every screen prints the room's figure and the staff wall says what stands beneath it; every card with its value, its part's label, which pile it is in, whether a model participant wrote it, and whether it belongs to the viewer; and every pile with its name, its sentence, its count, and whether it was picked to carry forward. The dashboard, the projector, and a phone after hand-in all read this former; the phone's cards are marked `mine` against its own response and carry no other identity. Raw and grouped are two readings of the same cards — the frontend groups by pile — so nothing on the wall is stored twice.

## Sorting by hand

[Live.walls.OpenPile](reaction:Live.walls.OpenPile) names a pile and, given a card, puts the card in it in one request, which is what dragging a card onto the new-pile cell does; given no card — [cardGiven](computation:cardGiven) — it opens the pile empty, which is what a click on the cell does, so a staff member can open a pile for what the room is about to say. Naming a pile that already exists on this wall reaches it rather than making another. A round's standing piles, authored on its leg before class, are seeded onto the wall the same way when the round opens, which the rounds page explains. [Live.walls.MoveCard](reaction:Live.walls.MoveCard) moves a card into a pile, [Live.walls.ToTray](reaction:Live.walls.ToTray) sends it back to the tray, [Live.walls.RenamePile](reaction:Live.walls.RenamePile) renames a pile, and [Live.walls.MergePile](reaction:Live.walls.MergePile) folds one pile into another, every card moving with it. A card is only ever placed on its own wall: opening a pile with, or moving, a card that is not one of the round's — [cardStanding](computation:cardStanding) — is refused `CARD_NOT_FOUND`. [Live.walls.Pick](reaction:Live.walls.Pick) picks a pile of a closed round to carry into a round that takes the picked piles, and [Live.walls.Unpick](reaction:Live.walls.Unpick) unpicks it: a pick is a Pinning pin in the round's scope, one request per pile, so two dashboards never overwrite each other's whole set, and the first pile picked stands highest so the picked read back in the order they were taken. A pile that is not on this wall is refused `NOT_FOUND`, so nothing from another wall can be carried; picking a picked pile, or unpicking an unpicked one, changes nothing. A vote's choice nobody chose leaves no ballot, so it has no pile to pin: [Live.walls.OpenChoice](reaction:Live.walls.OpenChoice) opens the empty pile of a choice the round's captured question offered — [answerKind](computation:answerKind) again — and the dashboard picks what it opened, so an unchosen choice carries forward as an empty group. Naming a choice whose pile already stands reaches that pile rather than making another, and a name the round never offered is refused `NOT_FOUND` the way a pile of another wall is. A pile merged away is unpinned — [Live.walls.MergedPileIsUnpicked](reaction:Live.walls.MergedPileIsUnpicked), with no clause on the kind: an item merged away carries no pins whatever it was.

A room of strangers will, once, hand in something the room should not read. [Live.walls.RemoveCard](reaction:Live.walls.RemoveCard) takes a card off the wall: the card is trashed, the hand-in behind it is kept, so the figure still counts the student, and every screen loses the card on its next poll. A removed card leaves the pile that held it — [Live.walls.RemovedCardLeavesItsPile](reaction:Live.walls.RemovedCardLeavesItsPile), bound to a pile of a wall, so a trashed forum post keeps its category — and the wall neither lists it nor counts it. The passages the model reads take the room's answers less the removed cards, so a removed card is on no list the model is asked about, and a placing reply still in flight that names it is dropped as a line about a card the wall no longer holds. A removed card is no card of this wall: moving it, opening a pile with it, or removing it again is refused `CARD_NOT_FOUND` like a card of another wall. Nothing restores a removed card from the dashboard; the hand-in it came from is still the student's.

## Sorting by the model

The model sorts on a cadence, not per card. While the run's switch says the model sorts (a fact of the run the relays page holds, the same on every dashboard), each open dashboard asks [Live.walls.Sort](reaction:Live.walls.Sort) once every three seconds, matching its poll. The endpoint asks Reasoning only while the round and its run are open, some card is in the tray, no ask about this round is still pending, no placing offering about it still has lines to take, and the last ask about it did not fail in the past thirty seconds — [failureStanding](computation:failureStanding); [Live.walls.SortNotAsked](reaction:Live.walls.SortNotAsked) answers the same path, that nothing was asked, whenever one of those does not hold. Asking takes the round's own Locking lock before it reads the passage: the lock is the tick's ask, held where one holder is the rule, so of the dashboards ticking together one asks, a tick that finds the lock held is answered that nothing was asked, and a tick that reaches the lock in the same instant stops at the refused lock, which the wire answers as a conflict and the dashboard's tick reads as no ask of its own. [Live.walls.AnsweredAskUnlocksRound](reaction:Live.walls.AnsweredAskUnlocksRound) and [Live.walls.FailedAskUnlocksRound](reaction:Live.walls.FailedAskUnlocksRound) give the lock back when the ask settles, answered or failed, so whatever takes an ask out of Reasoning's pending set gives the round's lock back with it and the round is locked exactly while the tick's own ask is out; the ask a complaint sends back takes no lock, since the pending ask it stands on already holds the tick. An insistence standing with no ask in flight does not hold the tick, so a reply lost on its way costs one cadence, not the round. The wall carries the newest failure about the round, so the dashboard can say the model is not answering. The passage — [placingPassage](computation:placingPassage) — carries the round's captured question, the author's notes to the sorter when any stand, the piles as they stand with their cards, and only the unsorted cards, each under a short label, and asks the model to place each card in a pile on the list or to open a new pile for it. The notes are two: the relay's, Guiding guidance on the round's leg under `sorting`, which the editor writes and the rounds page owns; and the run's, guidance on the round's own edition under the same use, which the dashboard's Sorting panel writes through [Live.walls.SetNotes](reaction:Live.walls.SetNotes) — one entry, set whole each time, so two dashboards writing at once leave one — and [Live.walls.ClearNotes](reaction:Live.walls.ClearNotes) removes, answering whether one stood; both are refused `CLOSED` once the run has closed. Every ask reads both from where they stand rather than frozen with the question, the relay's first and the run's after it, joined as one text by [sorterNotes](computation:sorterNotes), and the contract says the later note wins, so a run's note adds to or overrides the relay's for this run alone: nothing is copied to the leg, so the next run of the relay starts with the relay's note and nothing after it, and a note revised on either side between asks reaches the next one. The wall's read carries the run's note, so the panel shows it beside the relay's. Labels stay put as answers stream in because the piles are never re-derived.

The tick asks about an open round only; the close settles the wall. [Live.walls.ClosedRoundSettlesWall](reaction:Live.walls.ClosedRoundSettlesWall) makes one last ask when a round closes with the run's switch on and a card still in the tray — the tick's path and the tick's passage, under the tick's guards, so an ask already out at the close is the settling ask and nothing asks twice — and after it the model never touches the round unless a hand presses Resort. With the switch off the close asks nothing, and the wall stands as the hand left it. The wall's read carries `asksOut`, how many asks about the round are pending, so the panel can say the model is sorting, settling, or settled without a clock of its own.

The switch is the run's standing consent; two more endpoints let a staff member act on purpose, and the dashboard's one button beside the switch — Resort while it is on, Empty the piles while it is off — is made of them. [Live.walls.SortNow](reaction:Live.walls.SortNow) makes one deliberate ask about the shown round, whether the switch is on or off and whether the round is open or closed, as long as the run is open and a card is in the tray: the tick's guards less the round's own openness, since the passage reads only what a closed round keeps, taking the same lock so the tick and two dashboards never ask at once. [Live.walls.SortNowNotAsked](reaction:Live.walls.SortNowNotAsked) answers the same path that nothing was asked where the tick would, and `CLOSED` once the run has. It is an endpoint of its own rather than a flag on the tick so each path keeps total guards. [Live.walls.EmptyPiles](reaction:Live.walls.EmptyPiles) sends every card of the shown round back to the tray in one request, on any round of an open run: the read of the round's cards continues once per card in a pile and each is unassigned in the same flow, while the piles stand, empty, with their names, lids, and picks, so a wall just emptied is a wall of standing piles. It takes no lock and waits for no ask — a reply that lands afterward places the cards it was asked about, and on an open round the next tick places the rest. [Live.walls.EmptyPilesNotNeeded](reaction:Live.walls.EmptyPilesNotNeeded) answers a wall with nothing in a pile that nothing was emptied, and refuses `CLOSED` once the run has closed. Resort — empty, then ask once — is the two requests in order on the dashboard; no endpoint. Resort on a settled round empties and asks again, so the room sees a shuffle, which is the deliberate cost of pressing it; a card sent to the tray on a settled round stays there.

[Live.walls.ReplyPlacesCards](reaction:Live.walls.ReplyPlacesCards) reads a usable reply into an offering of suggestions about the round — one `place` line per card put in a pile that exists, one `open` line per card that opens a new pile — through [placingLines](computation:placingLines), and [Live.walls.PlacingOfferingIsTaken](reaction:Live.walls.PlacingOfferingIsTaken) takes every line of a placing offering at once, since the switch is the staff member's standing consent. Taking a `place` line assigns the card ([Live.walls.TakenPlaceAssignsCard](reaction:Live.walls.TakenPlaceAssignsCard)); taking an `open` line files the card under the named pile on this wall in one ask ([Live.walls.TakenOpenMakesPile](reaction:Live.walls.TakenOpenMakesPile)), so two cards opening the same new pile in one reply land together, and the lines of one reply, taken in one flow, never read each other's card. A line naming a card some pile already holds is a no-op: the wall moved under the ask, so the line is dropped rather than the reply stood upon. A reply made only of such lines reads `nothing`: usable, offering nothing, and not stood upon. A card neither the tray nor any pile holds is no card of this wall, and the reply is stood upon as before.

A reply that names a pile not on the list and not marked new, or that is not readable at all, is stood upon: [Live.walls.ReplyUnusableComplains](reaction:Live.walls.ReplyUnusableComplains) opens an insistence on the round with the account of what was wrong, [Live.walls.ComplaintRetriesTheAsk](reaction:Live.walls.ComplaintRetriesTheAsk) sends the exchange back through [placingRepairPassage](computation:placingRepairPassage) while patience remains, [Live.walls.PlacedReplySatisfiesInsistence](reaction:Live.walls.PlacedReplySatisfiesInsistence) settles the insistence when a usable reply lands — `placed`, `nothing`, or `lid`, whether or not it has a line to offer — and [Live.walls.SpentPatienceGivesUp](reaction:Live.walls.SpentPatienceGivesUp) gives up once it is spent — the next tick simply asks again over whatever is still unsorted. [Live.walls.FailedAskGivesUp](reaction:Live.walls.FailedAskGivesUp) closes an insistence when the reasoner could not be reached.

## The lid

A pile's sentence is its category's description. [Live.walls.Summarize](reaction:Live.walls.Summarize) asks the model for one sentence over a pile's cards through [lidPassage](computation:lidPassage), and answers that nothing was asked for a pile with no cards; [Live.walls.ReplyOffersLid](reaction:Live.walls.ReplyOffersLid) reads the reply into a `lid` suggestion about the round, taken like any placing line, and [Live.walls.TakenLidDescribesPile](reaction:Live.walls.TakenLidDescribesPile) writes it onto the pile. [Live.walls.DescribePile](reaction:Live.walls.DescribePile) lets a person write or fix the sentence by hand.

## The model participant

When a response begins under a participant that holds a seat on the round's run — a Subscribing subscription the dashboard made — [Live.walls.BegunModelResponseAsksMind](reaction:Live.walls.BegunModelResponseAsksMind) puts the round's face before Reasoning as a participant would read it — [participantPassage](computation:participantPassage), seeded by the participant identity so forty invited participants do not all say the same thing — and asks for one answer per part. The participant worker on the floor then plays the phone: once the reply stands and the participant's own jittered delay has passed, it answers each item through Responding and hands in, so the cards land in the tray like anyone else's and are placed by the same sorting. A reply the worker cannot read leaves that participant begun and never handed in, which the figure shows as one still writing.

```computations
failureStanding(failedAt: Date, at: Date) : String
  Answers `fresh` while a failed ask is under thirty seconds old, so the sort
  tick waits it out rather than spending a call a tick on a reasoner that is
  not answering, and `stale` after.

cardStanding(card: String, values: Json) : String
  Answers `known` when the card is one of the wall's cards, minted from a value
  the room handed in, and `unknown` otherwise.

pickPriority(count: Number) : Number
  The priority a pile picked after `count` others takes, so the first pile
  picked stands highest and the picked read back in the order they were taken.

cardId(response: String, item: String) : String
  Mints the wall's identity for one answer from its response and item, so a
  card names neither.

isSame(left: String, right: String) : Bool
  Says whether two identities are the same, which is how a phone's own cards are marked.

sorterNotes(relay: String, run: String) : String
  Joins the two notes whoever sorts a round reads as one text: the relay's
  note first and the run's after it, a blank line between, each trimmed and a
  blank one left out, so either standing alone is the whole text and neither
  standing is an empty string.

placingPassage(value: Json, categories: Json, values: Json, removed: Json, notes: String) : String
  Renders the passage that asks the model to place each unsorted card into a
  pile on the list or open a new pile for it, given the round's captured
  question, the author's notes to the sorter as one text, the piles as they
  stand with their cards, every value the room handed in, and the items in the
  trash — from which the cards still in the tray, less the removed, follow,
  each under a label numbered over every hand-in, so the labels hold still
  when a card is removed and a reply in flight still names the cards it was
  asked about. The notes stand as their own section after the question, and
  blank notes leave no section.

placingRepairPassage(value: Json, categories: Json, values: Json, removed: Json, notes: String, offering: String, account: String) : String
  Renders the passage that stands on a placing ask: the same standing wall
  and note, the exact reply that came back, and the account of what was wrong.

cardGiven(card: String) : String
  Answers `given` when a request names a card, and `none` when it names none,
  which is how one endpoint opens a pile with or without a card.

placingReading(reply: String, categories: Json, values: Json, removed: Json) : String
  Reads a reply the round asked for and answers `placed`, `nothing`, `lid`, or
  `neither`. A reply that places a card the wall has since sorted is `placed`
  while some line still has a card to place, and `nothing` when no line does;
  only a card neither the tray nor any pile holds makes it `neither`.

placingLines(reply: String, categories: Json, values: Json, removed: Json) : Json
  Answers the suggestion lines of a usable placing reply: `place` lines
  naming a card and an existing pile, `open` lines naming a card and a new
  pile's name, and no line at all for a card some pile already holds.

placingReason(reply: String, categories: Json, values: Json, removed: Json) : String
  Answers the account of why a reply could not be used, and an empty
  string when it could.

lidPassage(pile: String, categories: Json, values: Json, removed: Json) : String
  Renders the passage that asks for one sentence a pile's cards stand on,
  naming the pile and reading its cards, less the removed, off the same
  standing wall.

lidLines(reply: String, categories: Json) : Json
  Answers the one `lid` suggestion line of a readable summary reply, and an
  empty sequence otherwise.

participantPassage(value: Json, participant: String) : String
  Renders the passage that asks the model to answer a captured presentation —
  a round's face or a questionnaire run's — as one participant: every question
  numbered with the groups carried from an earlier round when it takes
  context, its choices, and its boxes, one answer per box, seeded by the
  participant identity.

participantAnswers(reply: String, value: Json) : Json
  Reads a participant reply into `{ item, value }` pairs for the round's
  items, and an empty sequence when the reply cannot be read.

answerKind(value: Json, answer: String) : String
  Answers `choice` when the answer is one of the choices the captured question
  offered, and `written` otherwise.

partLabel(value: Json, item: String) : String
  Answers the label of the part an item names, and an empty string for a
  question without parts.
```

```endpoints
Live.walls.ClearEmptyPiles at /live/walls/clear-empty-piles
Live.walls.ClearNotes at /live/walls/clear-notes
Live.walls.DescribePile at /live/walls/describe-pile
Live.walls.EmptyPiles at /live/walls/empty-piles
Live.walls.EmptyPilesNotNeeded at /live/walls/empty-piles
Live.walls.MergePile at /live/walls/merge-pile
Live.walls.MoveCard at /live/walls/move-card
Live.walls.OpenChoice at /live/walls/open-choice
Live.walls.OpenPile at /live/walls/open-pile
Live.walls.Pick at /live/walls/pick
Live.walls.Unpick at /live/walls/unpick
Live.walls.Read at /live/walls/read
Live.walls.RemoveCard at /live/walls/remove-card
Live.walls.RenamePile at /live/walls/rename-pile
Live.walls.SetNotes at /live/walls/set-notes
Live.walls.Sort at /live/walls/sort
Live.walls.SortNotAsked at /live/walls/sort
Live.walls.SortNow at /live/walls/sort-now
Live.walls.SortNowNotAsked at /live/walls/sort-now
Live.walls.Summarize at /live/walls/summarize
Live.walls.ToTray at /live/walls/to-tray
```

[ClearEmptyPiles](reaction:Live.walls.ClearEmptyPiles) removes only empty, unpicked piles whose names are outside the round's starting set. It refuses cleanup while the sorter is working or applying an offering, and after the run closes. Responses and nonempty piles are retained.

[ MergedReservedPileKeepsReservation ](reaction:Live.walls.MergedReservedPileKeepsReservation) reserves the merge destination before removing the source's pins. [ MergedReservedPileWasAlreadyKept ](reaction:Live.walls.MergedReservedPileWasAlreadyKept) removes only obsolete source pins when the destination is already reserved. Cleanup respects reservations by identity; matching an authored pile's current name remains a compatibility fallback for existing runs created before reservations were recorded.

Cleanup calls Categorizing.deleteEmptyCategory, which rechecks emptiness within the Concept action. A card assigned after the composition read therefore prevents deletion; cleanup never unassigns an occupied pile.
