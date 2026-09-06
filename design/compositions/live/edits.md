# Edits the model proposes

The model never edits a relay or a wall directly. Every job it does — placing cards, summarizing a pile, drafting rounds — comes back as a reply, and a reaction translates that reply into suggestion lines, each one a concept action and nothing else: add, remove, or move a round; set a round's title, prompt, parts, or choices; set what a round takes; open, rename, or merge a pile; move a card. The wall page's lines are taken as they arrive because the staff member's switch already said so. The lines on this page wait for a person: the setup page's panel shows them one by one, each confirmed or dismissed, or all accepted at once. Every endpoint here requires `live:host`.

## Drafting a relay

[Live.edits.Draft](reaction:Live.edits.Draft) puts a brief before Reasoning together with the relay as it stands — its rounds with title, prompt, parts, choices, and takes, read through Relaying's plan and Questioning's materials and rendered by [relayDraftPassage](computation:relayDraftPassage), together with the title the relay goes by and whether that title is only the placeholder its brief minted — and asks for the whole relay as it should read afterward, its own name included; a blank brief — [briefStanding](computation:briefStanding) — is refused `INVALID_REQUEST` before any ask is spent. The passage lives beside the frozen questionnaire-drafting contract and never changes it. Between the contract and the relay as it stands the passage sets down the background documents the drafting page holds — the class's, then this relay's — as one fenced block, and none when none stands, so a relay without documents is asked with the passage it always was; the repair passage stands on the passage that was asked, so it carries the same block. [Live.edits.ReplyOffersRelayEdits](reaction:Live.edits.ReplyOffersRelayEdits) reads a usable reply against the same standing relay through [relayEditLines](computation:relayEditLines) and offers the difference as lines about the relay. The passage shows every standing round with its number, its standing piles with their sentences, and its note to the sorter — the piles and notes read off each leg through [legIdentities](computation:legIdentities) — and asks the reply to keep that number on a round it keeps, renames, or moves, and to number a new round 0, so a round keeps its identity the way a refined questionnaire does: `title`, `prompt`, `parts`, and `choices` for a round whose field changed; `pile` for a standing pile that is new or whose sentence changed, `unpile` for one the reply no longer names, and `notes` for a round whose note changed; `move` for a round that lands at another number; `remove` for a standing round the reply no longer names; `add` for a round numbered 0, carrying its piles, its note, its takes, and the number it lands at; and `takes` for a round whose takes changed, naming the source by its number in the delivered relay. The relay's own name comes first, as a `title` line naming no round: [relayDraftReading](computation:relayDraftReading) answers `named` for a reply that names a relay still standing under the placeholder its brief minted, and that one line is taken where it is offered, so the relay carries the model's name without being asked about it; a relay named by hand is asked like anything else. The lines come in the order they apply — takes cleared off a source that goes, removes, field edits, moves, adds, the takes that remain — so each reads the relay the earlier lines made. A reply that numbers no round is read by position, which is how a draft over an empty relay reads. A reply that leaves the relay as it stands offers one `keep` line, so the panel can say nothing needs to change; taking it changes nothing. A reply that cannot be read is stood upon once, through Insisting, by [Live.edits.ReplyUnusableComplains](reaction:Live.edits.ReplyUnusableComplains), [Live.edits.ComplaintRetriesTheAsk](reaction:Live.edits.ComplaintRetriesTheAsk), [Live.edits.OfferedEditsSatisfyInsistence](reaction:Live.edits.OfferedEditsSatisfyInsistence), and [Live.edits.SpentPatienceGivesUp](reaction:Live.edits.SpentPatienceGivesUp); a reasoner that could not be reached closes the insistence through [Live.edits.FailedAskGivesUp](reaction:Live.edits.FailedAskGivesUp), and the panel reads that nothing came.

## Confirming a line

[Live.edits.Offerings](reaction:Live.edits.Offerings) forms [the offerings about a relay](former:Live.edits.theOfferings): every offering, newest first, with its lines in order and where each stands, which the panel polls while a reply is out and shows once it lands. [Live.edits.Take](reaction:Live.edits.Take) takes one line and [Live.edits.Decline](reaction:Live.edits.Decline) declines one. Accepting every line is one request per line, in the offering's order, because the asks that apply an added round read their line back through the request that took it, and two lines taken in one request would read each other's. Take refuses `RUN_OPEN` for a line about a round whose run is open, before anything changes, so the panel and the setup page's own edits are held to the same rule. Taking is what applies a line:

- [Live.edits.TakenAddAddsRound](reaction:Live.edits.TakenAddAddsRound) composes the round's questionnaire, adds its question, sets its parts, and appends the leg — the same chain the setup page's own button runs — then moves it to the number the line says it lands at and draws what the line says it takes. The round's piles and note need the round as their target, so [Live.edits.AddedRoundCarriesItsPiles](reaction:Live.edits.AddedRoundCarriesItsPiles) reads the add line back off the leg the take composed — [editRoundLines](computation:editRoundLines), [linesStanding](computation:linesStanding) — offers them as `pile` and `notes` lines about the new round rather than the relay, and takes each where it is offered, since the person accepted them with the round; the panel, reading offerings about the relay, never sees them.
- [Live.edits.TakenPileStandsPile](reaction:Live.edits.TakenPileStandsPile) reaches or makes the named standing pile on the round and writes its sentence — [editPileName](computation:editPileName), [editPileSentence](computation:editPileSentence) — and [Live.edits.TakenUnpileRemovesPile](reaction:Live.edits.TakenUnpileRemovesPile) takes a standing pile off the round by its name. [Live.edits.TakenNotesSetNote](reaction:Live.edits.TakenNotesSetNote) and [Live.edits.TakenNotesRemoveNote](reaction:Live.edits.TakenNotesRemoveNote) write the round's note to the sorter as the rounds page does: replaced through Guiding.set as one standing note, or cleared through Guiding.clear when the line says nothing — [briefStanding](computation:briefStanding) tells a note from a blank.
- [Live.edits.TakenRemoveRemovesRound](reaction:Live.edits.TakenRemoveRemovesRound) removes the leg and retires its questionnaire; Relaying refuses while another round takes from it, and the panel shows the refusal.
- [Live.edits.TakenMoveMovesRound](reaction:Live.edits.TakenMoveMovesRound) places the round at the line's position; Relaying refuses an order that would put a round before what it takes from.
- [Live.edits.TakenTitleRetitlesRound](reaction:Live.edits.TakenTitleRetitlesRound), [Live.edits.TakenPromptRevisesRound](reaction:Live.edits.TakenPromptRevisesRound), [Live.edits.TakenChoicesReviseRound](reaction:Live.edits.TakenChoicesReviseRound), and [Live.edits.TakenPartsSetParts](reaction:Live.edits.TakenPartsSetParts) each change one field of the round's question and leave the rest as it stands.
- [Live.edits.TakenTitleRetitlesRelay](reaction:Live.edits.TakenTitleRetitlesRelay) retitles the relay itself for a `title` line that names no round.
- [Live.edits.TakenTakesDraws](reaction:Live.edits.TakenTakesDraws) sets what a round takes, naming the source by its number — Relaying replaces the draw that stood, so a round takes from one source; [Live.edits.TakenTakesUndraws](reaction:Live.edits.TakenTakesUndraws) clears it when the line says the round takes nothing.

A line refused by a concept stays taken with its refusal in the log, and the panel, reading the relay back, shows what did not change.

```computations
briefStanding(request: String) : String
  Answers `given` when a brief says anything, and `blank` when it is empty or
  whitespace.

relayDraftPassage(request: String, title: String, legs: Json, materials: Json, piles: Json, notes: Json, classDocuments: Json, relayDocuments: Json) : String
  Renders the passage that asks the model for a whole relay from a brief and
  the relay as it stands — each round with its standing piles and its note to
  the sorter — under the title it goes by and whether the brief minted it,
  with the background documents, the class's then the relay's, fenced between
  the contract and the relay, and absent when none stands.

legMaterials(legs: Json) : Strings
  Answers the materials of a relay plan's legs, in order.

legIdentities(legs: Json) : Strings
  Answers the legs of a relay plan, in order, by which their standing piles
  and notes are read.

relayDraftRepairPassage(passage: String, offering: String, account: String) : String
  Renders the passage that stands on a relay-drafting ask: the passage that was
  asked, with the exact reply and the account of what was wrong.

relayDraftReading(reply: String, passage: String) : String
  Reads a relay-drafting reply against the passage it answers: `relay`,
  `named` for one that names a relay still standing under its minted
  placeholder, or `neither`.

relayDraftReason(reply: String) : String
  Answers why a relay-drafting reply could not be read, and an empty string
  when it could.

relayEditLines(reply: String, title: String, legs: Json, materials: Json, piles: Json, notes: Json) : Json
  Answers the suggestion lines that turn the relay as it stands into the
  drafted one: the relay's own name first, then by the numbers the reply
  keeps, or by position when it numbers no round; one `keep` line when
  nothing changes.

editRoundJson(value: String) : Json
  Reads an `add` line's value into the round it describes, its piles and
  note included.

editRoundLines(value: String, leg: String) : Json
  Answers the `pile` and `notes` lines an added round carries, addressed to
  the leg it became.

linesStanding(lines: Json) : String
  Answers `some` when there are lines to offer and `none` when there are not.

editPileName(value: String) : String
  Reads a `pile` line's value into the pile's name.

editPileSentence(value: String) : String
  Reads a `pile` line's value into the pile's sentence.

editRoundTakesFrom(round: Json) : Number
  Reads the number of the round an added round takes from, and 0 when it
  takes nothing.

editRoundTakesUse(round: Json) : String
  Reads the use an added round makes of what it takes, and an empty string
  when it takes nothing.

editRoundPosition(round: Json) : Number
  Reads the number an added round lands at, and 0 when it goes last.

editTitle(round: Json) : String
  Reads the round's title.

editPrompt(round: Json) : String
  Reads the round's prompt.

editRoundParts(round: Json) : Strings
  Reads the round's part labels.

editRoundCap(round: Json) : Number
  Reads the round's cap.

editRoundChoices(round: Json) : Strings
  Reads the round's choices.

editParts(value: String) : Strings
  Reads a `parts` line's value into part labels.

editCap(value: String) : Number
  Reads a `parts` line's value into its cap.

editChoices(value: String) : Strings
  Reads a `choices` line's value into choices.

editPosition(value: String) : Number
  Reads a `move` or `takes` line's value into a round number.

editUse(value: String) : String
  Reads a `takes` line's value into a use, and an empty string when the
  round takes nothing.
```

```endpoints
Live.edits.Decline at /live/edits/decline
Live.edits.Draft at /live/edits/draft
Live.edits.Offerings at /live/edits/offerings
Live.edits.Take at /live/edits/take
```

Relay drafting reads only the relay's selected reference documents. Library membership alone does not include a document.
