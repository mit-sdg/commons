# Relays and their runs

A relay is a series of rounds a staff member runs in one meeting: each round is one question, answered on phones, and a later round can take what an earlier one produced — the piles the room's answers were sorted into become the next round's choices. The concept behind it, Relaying, speaks of legs and draws; every endpoint, former, and screen here says **round** and **takes**. A round is a leg; what a round takes from an earlier one is that leg's draw. Every endpoint on this page requires `live:host`.

## Authoring a relay

Each round's question is an ordinary questionnaire of the survey form holding exactly one question, so a round's title is its questionnaire's title and everything Questioning knows — prompts, choices, parts — is the round's. The relay holds the order and the takes. [Live.relays.Plan](reaction:Live.relays.Plan) plans an empty relay under a title, [Live.relays.Retitle](reaction:Live.relays.Retitle) renames it, and [Live.relays.Retire](reaction:Live.relays.Retire) retires it when its teaching life ends: a retired relay is refused a launch with `RELAY_RETIRED`, its runs stay readable, and retiring is refused with `RUN_OPEN` while a run is open. A retired relay is a trashed one, so the list and the relay both carry `retired`. [Live.relays.AddRound](reaction:Live.relays.AddRound) composes the round's questionnaire, adds its one question, sets the question's parts, and appends the leg after checking the complete input against Questioning’s material rules. Invalid material returns `INVALID_REQUEST` before any change. [Live.relays.ReviseRound](reaction:Live.relays.ReviseRound) checks the complete replacement before rewriting a round in place: it clears the question's parts, revises the prompt and choices, and sets the parts again, in that order, so a round may move from choices to parts or back in one request; [Live.relays.ReviseRoundRefused](reaction:Live.relays.ReviseRoundRefused) answers the same path with `RUN_OPEN` for a round whose questionnaire has an open run, and `LEG_NOT_FOUND` for a round that does not exist, before anything changes. [Live.relays.RemoveRound](reaction:Live.relays.RemoveRound) removes the leg — Relaying refuses while another round still takes from it — and retires its questionnaire so the shelf never shows it as a survey of its own. [Live.relays.MoveRound](reaction:Live.relays.MoveRound) places a round at a position, and Relaying refuses any order that would put a round before what it takes from. [Live.relays.SetTakes](reaction:Live.relays.SetTakes) records what a round takes from an earlier one — a source round and a use — and [Live.relays.ClearTakes](reaction:Live.relays.ClearTakes) removes it; a use this composition does not fill, or one the table below shuts to the round's kind — [useFit](computation:useFit) — is refused `INVALID_USE`. Every write to a retired relay — retitling it, adding, revising, removing, or moving a round, setting or clearing what a round takes — is refused `RELAY_RETIRED`.

These checks preserve existing work on invalid input. The actions are separate writes; concurrent retirement or a storage interruption can still leave a request partly applied.

## Kinds and uses

A round is one of three kinds: **write** (one box), **list** (parts: labeled boxes, or one box repeated up to a cap), or **vote** (choices). The kind is the leg's word, set by [Live.relays.SetKind](reaction:Live.relays.SetKind) when the editor presses one, so a vote whose choices are not written yet is still a vote after a reload; a leg with no word is the kind its content makes it. The word is a selector, not a clearing: the question keeps what it holds, and the leg its standing piles and its note, whatever the kind, and the kind decides what is used — a write round opens as one box, a list with its parts, a vote with its choices, each leaving the rest on the question ([kindChoices](computation:kindChoices), [kindParts](computation:kindParts), [kindCap](computation:kindCap)), so pressing another word and pressing back loses nothing. A question offers choices or takes parts, not both, which is Questioning's rule; a round holding parts keeps them under the word `vote` until a choice is written, and writing one is what replaces them, as writing a part replaces a round's choices. A vote's wall is its choices, so its standing piles are not seeded onto it and its note is never asked. The relay's read carries each round's `kind` as the leg holds it, empty when none was set, and the fields as they were written. A relay holding a vote with nothing to vote on — the leg's word is `vote`, the question offers no choice, and no take fills them: [voteStanding](computation:voteStanding) — is refused a launch with `NO_CHOICES`, from every screen, so the guard reads what the editor pressed rather than what the question holds. Every round leaves named groups with counts on its wall — piles for a write or list round, and for a vote round the choices with their tallies, since the wall page files each ballot under a pile of its choice's name, and a choice nobody chose becomes an empty pile the moment the pick names it. Which groups carry forward is the staff member's pick on the dashboard, made after the source round closes; nothing about the pick is authored. What a round does with the picked groups is its take's use, and the use is open only to some kinds:

| Use       | Kinds             | What it does when the round opens                                  |
| --------- | ----------------- | ------------------------------------------------------------------ |
| `context` | write, list, vote | the picked groups, with their cards, are shown above the prompt    |
| `choices` | vote              | the picked groups' names are the choices, and the round is one box |
| `parts`   | list              | the picked groups' names are the parts, one box each               |

[Live.relays.Uses](reaction:Live.relays.Uses) forms this table — [carryUses](computation:carryUses) — for the editor, its explainer, and the drafting passage, so the words have one home. Whether a use is open is read off the leg's word, and off the question's content only for a leg with no word ([useFit](computation:useFit)). A round that takes its choices or parts is authored with none of its own.

A question's parts are how one phone hands in several answers: labeled boxes (one, two, three) or one box repeated up to a cap. Each box is an item of its own, `question#n`, and each value handed in is one card on the wall. The shelf's questionnaire list leaves a round's questionnaire out, since a round is reached through its relay.

[Live.relays.List](reaction:Live.relays.List) forms [the relays](former:Live.relays.theRelays) — every relay, newest first, with its rounds as number and title and the edition each has in the open run, its open run and the round open to the room in it when one stands, and the figure of that round (begun and handed in) — which is what the Live list shows beside the questionnaires. [Live.relays.Get](reaction:Live.relays.Get) forms [one relay whole](former:Live.relays.theRelay): each round with its questionnaire, question, prompt, parts, choices, and takes, its standing piles and its note to the sorter — which the rounds page owns — and the relay's runs, newest first, each with the rounds published within it, earliest first, and their figures.

## A run, and a run per round

[Live.relays.Launch](reaction:Live.relays.Launch) publishes the relay itself as an open edition — the run — and issues its share token and durable room code in the same request, exactly as a questionnaire launches. Nothing is captured at launch: the relay stays editable between rounds, and each round freezes only when it opens. A participant's token stays on the run for the whole meeting.

A round is published within its run: [Live.relays.OpenRound](reaction:Live.relays.OpenRound) asks Publishing to publish the round's questionnaire within the run, so the round is tied to its run by the same write that opens it. Publishing's own rules then keep a run to one open round and each round to one opening in a run, across processes as well as within one, and publish a round only within a run that is still open. Opening is two writes: the round, then its presentation. Between them the round is **opening**: it is the run's open part with nothing yet for a phone to show. It becomes **open to the room** once its presentation is captured, and every reader that means the room answers this round — a phone's face, Begin, a seat taken while it is open — reads the open round in that sense.

The request says what it opens: `{ run, leg, picked }`, where `picked` is the piles the dashboard showed as picked, in the order the closed wall shows them, fullest first, and defaults to none. A round opens when the host may host, the round is one of this run's relay, it has not run in this run, no round of the run is open or opening, the run is open, and the round is ready: it takes nothing, or the round it takes from has closed in this run and every picked pile still stands on that round's wall ([pickStanding](computation:pickStanding)). The capture stage then forms the presentation with [roundPresentation](computation:roundPresentation) from the leg's question as it stands and the groups [openingGroups](computation:openingGroups) resolves from the request's picks, in the request's order. [pileCards](computation:pileCards) keeps written answers literally and carries ballots' original supporting examples from their captured questions, preserving that history through later renaming and merging. Choices and parts receive the picked group names; every take use keeps the groups as context, and dynamic choices keep their examples as choiceSources. The answer is `{ round }`, given as soon as the presentation is captured. If the run closed between the round and its presentation, the round was closed with it, nothing is captured, and the answer is `{ declined: "CLOSED" }`.

A press is safe to repeat. [Live.relays.OpenRoundAgain](reaction:Live.relays.OpenRoundAgain) answers a press for the round already open to the room with that round, and ensures again on its wall any standing pile of the leg that is missing or has lost its reservation — the same writes the capture's seeding makes, which a fault can leave undone. A press for the round the run holds open captures its presentation from that press's picks and answers the round, so the lecturer's next press finishes an opening the chain stopped partway through. It reads the run's open part, not whether the presentation has landed, so a press whose reads straddle another press's capture is still answered: when the presentation already stands, Snapshotting refuses the capture and the press is answered at once with the refusal's category, `CONFLICT`, and the board reads the run, which shows the round open.

A press that cannot open its round is answered as data by [Live.relays.OpenRoundDeclined](reaction:Live.relays.OpenRoundDeclined): `{ declined: WORD }` with the facts the board's sentence needs, never as an error. When several words hold, the first in this order answers:

| Word             | When                                                                       | Facts                             |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------- |
| `LEG_NOT_FOUND`  | the round is not one of this run's relay, or there is no such run or round | —                                 |
| `CLOSED`         | the run is closed                                                          | —                                 |
| `ROUND_DONE`     | this round already ran in this run and has closed                          | `round`: this round's number      |
| `SOURCE_UNRUN`   | the round it takes from has not run in this run                            | `source`: that round's number     |
| `SOURCE_OPEN`    | the round it takes from is still open or opening                           | `source`: that round's number     |
| `ROUND_OPEN`     | another round of the run is open or opening                                | `round`: the number of that round |
| `NOTHING_PICKED` | the round takes from another and the request picks nothing                 | —                                 |
| `PILE_GONE`      | a picked pile is no longer on the wall the round takes from                | —                                 |

`NOTHING_PICKED` and `PILE_GONE` also answer a press for a round left opening, since its presentation would be formed from those picks. A user who may not host is answered `FORBIDDEN`, as on every staff endpoint. Two presses that pass these reads together meet Publishing's rules: the loser's publish is refused, and that refusal reaches the board as its category, `CONFLICT`. An endpoint answers only along the posture its chain asks for, so no authored path can answer the refusal with the word; the board reads the run, which carries the round open or opening and every round's standing.

[Live.relays.CloseRound](reaction:Live.relays.CloseRound) closes the round's edition, open to the room or still opening; phones that answer afterward meet the same `CLOSED` refusal a closed quiz gives, and a round closed while opening counts as run. [Live.relays.Close](reaction:Live.relays.Close) closes the run, closing the round it holds open first, whether open or opening; a run already closed is answered `{ run }` at once, which a dashboard that has not yet read the close takes as done. [Live.relays.ClosedRunClosesRounds](reaction:Live.relays.ClosedRunClosesRounds) closes the run's open round whichever path closed the run, so a round published in the same instant the run closed does not stay open. Showing a closed round again is a read of its wall, never a change of state.

[Live.relays.Run](reaction:Live.relays.Run) forms [the run](former:Live.relays.theRelayRun): the relay's title, whether the run is open, its token and code, the round open to the room as `openRound`, the round left opening as `opening`, and every round with its number, title, and — when it was published in this run — its edition and [its figure](former:Live.relays.theRoundFigure): whether it is open, when it opened and closed, and how many responses were begun and handed in. It also carries the room: `here`, the devices on the participant link heard in the last minute, and `onOpenRound`, how many of those hold the round open to the room. The minute is counted back from the request's own instant by [roomSince](computation:roomSince). The room is Attending's alone, not the wall's figures: a device is here once its page checks in on the run, before it has begun anything, and stops counting a minute after it last checked in. The dashboard and the projector poll this while the run is open.

## The model participant

Seats live on the runs page now: `Live.runs.Invite` takes one, `Live.runs.Dismiss` gives it up, and the runs page states what a seat is and what the two endpoints refuse. On a relay run the seat is answered round by round: [Live.relays.SeatedParticipantAnswersOpenRound](reaction:Live.relays.SeatedParticipantAnswersOpenRound) begins the new seat's response to the round open to the room at that moment, and the participant worker begins a response for every seat still standing on each round open to the room that the seat has not begun, so the seats invited on round one answer round two without a second invitation, and a seat whose begin was lost is begun on the worker's next pass. From the begin on, the wall page's reactions and the participant worker hand the model's response in exactly as a phone would, on the participant's own clock. The run's read carries the seats standing, in the order they were taken, the round's figure how many of its hand-ins were the model's and how many of its seats nothing is coming for — a seat whose ask failed with no reply after, which the Model row says as not answering rather than writing — and the wall marks the model's cards; that mark is the only trace on any wall.

"Model sorts" is the run's switch, the same on every dashboard and readable by the projector: a Pinning pin of the run in the reserved scope `sorting`, set by [Live.relays.SortByModel](reaction:Live.relays.SortByModel) and cleared by [Live.relays.SortByHand](reaction:Live.relays.SortByHand), each answering the switch as it then stands and refusing `CLOSED` once the run has closed. The run's read carries it as `modelSorts`. A staff member who flips it flips it for the room; the wall page's cadence still runs from whichever dashboards are open, so a run with no dashboard open is not sorted.

## What a phone meets

The participation page owns the phone's endpoints; this page owns what they read for a relay. [The face of a relay run](former:Live.relays.theRelayFace) is what Arrive forms when the token opens onto a run whose material is a relay: the relay's title, whether the run is open, its rounds as number, title, and standing — done, open, or next — and the open round's edition and its question, with prompt, parts, and choices only. A round still opening is not on the face at all: the phone keeps waiting until the round is open to the room. A round closed while it was opening has no presentation either, but it is on the face as a round that ran, done, so the phone names the round after it as next. A phone begins a response to the open round, answers each part as an item of its own, and hands in; the round's edition is its subject, so the guards that refuse a closed run refuse a round that is not open.

```computations
pickStanding(picked: Strings, categories: Json) : String
  Answers `none` when the request picks no pile, `gone` when a picked pile is
  not among the wall's piles, and `ready` otherwise.

openingGroups(picked: Strings, categories: Json, values: Json, value: Json) : Json
  Resolves the picked piles' names and supporting cards in the order the
  request names them.

roundPresentation(content: Json, kind: String, use: Json, groups: Json, sourceValue: Json, sourceNumber: Json) : Json
  Forms the presentation a round opens with: the leg's question under its
  kind, with the picked groups as its choices, parts, or context by the take's
  use, and the round they came from.

kindChoices(kind: String, choices: Strings) : Strings
  Answers the choices the kind puts before the room: the round's own under
  `vote` or no word, and none under `write` or `list`.

kindParts(kind: String, parts: Strings) : Strings
  Answers the parts the kind puts before the room: the round's own under
  `list` or no word, and none under `write` or `vote`.

kindCap(kind: String, cap: Number) : Number
  Answers the cap that goes with the parts: the round's own under `list` or
  no word, and none otherwise.

carryUses() : Json
  Answers the table of uses: each use, the kinds it is open to, and the one
  sentence the editor shows beside it.

voteStanding(kind: String, choices: Strings) : String
  Answers `bare` when the kind is `vote` and the round offers no choice of its
  own, and `filled` otherwise; whether a take fills the choices is the view's
  to read.

useFit(use: String, kind: String, choices: Strings, parts: Strings) : String
  Answers `open` when the use is one the leg's word may carry, or, for a leg
  with no word, one the kind its choices and parts make may carry, or when
  such a leg holds neither and the take is what makes it a kind; `closed` when
  the table shuts it to that kind; and `unknown` when the word names no use.

roomSince(at: Date) : Date
  Answers the instant one minute before at: a device heard at or after it is
  here.

pileCards(pile: String, categories: Json, values: Json, value: Json) : Strings
  Answers written cards in hand-in order. Ballots contribute distinct examples
  from their original choiceSources in the captured question, preserving
  support through renaming and merging without guessing from pile names.
```

```endpoints
Live.relays.AddRound at /live/relays/add-round
Live.relays.ClearTakes at /live/relays/clear-takes
Live.relays.Close at /live/relays/close
Live.relays.CloseRound at /live/relays/close-round
Live.relays.Get at /live/relays/get
Live.relays.Launch at /live/relays/launch
Live.relays.List at /live/relays/list
Live.relays.MoveRound at /live/relays/move-round
Live.relays.OpenRound at /live/relays/open-round
Live.relays.OpenRoundAgain at /live/relays/open-round
Live.relays.OpenRoundDeclined at /live/relays/open-round
Live.relays.Plan at /live/relays/plan
Live.relays.RemoveRound at /live/relays/remove-round
Live.relays.Retire at /live/relays/retire
Live.relays.Retitle at /live/relays/retitle
Live.relays.ReviseRound at /live/relays/revise-round
Live.relays.ReviseRoundRefused at /live/relays/revise-round
Live.relays.Run at /live/relays/run
Live.relays.SetKind at /live/relays/set-kind
Live.relays.SetTakes at /live/relays/set-takes
Live.relays.SortByHand at /live/relays/sort-by-hand
Live.relays.SortByModel at /live/relays/sort-by-model
Live.relays.Uses at /live/relays/uses
```

## Guidance for the host

The relay editor and host run read a description and opening and closing
instructions from Guiding, plus each leg's purpose, facilitation, and selection
guidance. Participant and projector presentations never include these fields.
The host can set or clear description, opening, or closing through
`/live/relays/set-guide`, naming a field and body; blank text clears it.
Only hosts can write, retired relays refuse writes, and guidance remains
editable during a run. This is standing guidance, not a historical snapshot.

[Live.relays.SetGuide](reaction:Live.relays.SetGuide) writes the host field.

```endpoints
Live.relays.SetGuide at /live/relays/set-guide
```

[The relay guide](former:Live.relays.theRelayGuide) and
[the round guide](former:Live.relays.theRoundGuide) form host-only text.

The editor, overview and host dashboard share concise help for running a relay. It explains piles, manual and model sorting, nonempty Top/All selections, manual selection, explicit round opening, and the limits of carried evidence. The help distinguishes a vote's counts from a host decision and explains that an unvoted option carries no original examples. It gives a pause-and-adapt path when the next question lacks the material it needs. This common procedure accompanies the generated activity-specific guidance.

The generated relay description and each round’s purpose remain visible while detailed guidance is folded. The editor offers the corresponding fields for revision; the overview and dashboard show read-only guidance. “Session host guide” names activity-specific opening and closing advice, distinct from the shared “Running a relay” help. Guidance is not automatically expanded over the host’s round controls. Overview round cards use their full body width on narrow screens, with the number beside the title.

```computations
roundMaterialIsValid(title: String, prompt: String, choices: Strings, parts: Strings, cap: Number) : Boolean
  Checks a complete authored round against Questioning's title, material, and parts rules before creation or revision.
```

A relay launch accepts `requireSignIn`, default false, and establishes its Accessing
holder before issuing addresses. Every round inherits this parent policy exclusively.
The participant face exposes the Boolean sign-in requirement.
