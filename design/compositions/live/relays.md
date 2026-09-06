# Relays and their runs

A relay is a series of rounds a staff member runs in one meeting: each round is one question, answered on phones, and a later round can take what an earlier one produced — the piles the room's answers were sorted into become the next round's choices. The concept behind it, Relaying, speaks of legs and draws; every endpoint, former, and screen here says **round** and **takes**. A round is a leg; what a round takes from an earlier one is that leg's draw. Every endpoint on this page requires `live:host`.

## Authoring a relay

Each round's question is an ordinary questionnaire of the survey form holding exactly one question, so a round's title is its questionnaire's title and everything Questioning knows — prompts, choices, parts — is the round's. The relay holds the order and the takes. [Live.relays.Plan](reaction:Live.relays.Plan) plans an empty relay under a title, [Live.relays.Retitle](reaction:Live.relays.Retitle) renames it, and [Live.relays.Retire](reaction:Live.relays.Retire) retires it when its teaching life ends: a retired relay is refused a launch with `RELAY_RETIRED`, its runs stay readable, and retiring is refused with `RUN_OPEN` while a run is open. A retired relay is a trashed one, so the list and the relay both carry `retired`. [Live.relays.AddRound](reaction:Live.relays.AddRound) composes the round's questionnaire, adds its one question, sets the question's parts, and appends the leg — one request, so a half-made round never stands. [Live.relays.ReviseRound](reaction:Live.relays.ReviseRound) rewrites a round in place: it clears the question's parts, revises the prompt and choices, and sets the parts again, in that order, so a round may move from choices to parts or back in one request; [Live.relays.ReviseRoundRefused](reaction:Live.relays.ReviseRoundRefused) answers the same path with `RUN_OPEN` for a round whose questionnaire has an open run, and `LEG_NOT_FOUND` for a round that does not exist, before anything changes. [Live.relays.RemoveRound](reaction:Live.relays.RemoveRound) removes the leg — Relaying refuses while another round still takes from it — and retires its questionnaire so the shelf never shows it as a survey of its own. [Live.relays.MoveRound](reaction:Live.relays.MoveRound) places a round at a position, and Relaying refuses any order that would put a round before what it takes from. [Live.relays.SetTakes](reaction:Live.relays.SetTakes) records what a round takes from an earlier one — a source round and a use — and [Live.relays.ClearTakes](reaction:Live.relays.ClearTakes) removes it; a use this composition does not fill, or one the table below shuts to the round's kind — [useFit](computation:useFit) — is refused `INVALID_USE`. Every write to a retired relay — retitling it, adding, revising, removing, or moving a round, setting or clearing what a round takes — is refused `RELAY_RETIRED`.

## Kinds and uses

A round is one of three kinds: **write** (one box), **list** (parts: labeled boxes, or one box repeated up to a cap), or **vote** (choices). The kind is the leg's word, set by [Live.relays.SetKind](reaction:Live.relays.SetKind) when the editor presses one, so a vote whose choices are not written yet is still a vote after a reload; a leg with no word is the kind its content makes it. The word is a selector, not a clearing: the question keeps what it holds, and the leg its standing piles and its note, whatever the kind, and the kind decides what is used — a write round opens as one box, a list with its parts, a vote with its choices, each leaving the rest on the question ([kindChoices](computation:kindChoices), [kindParts](computation:kindParts), [kindCap](computation:kindCap)), so pressing another word and pressing back loses nothing. A question offers choices or takes parts, not both, which is Questioning's rule; a round holding parts keeps them under the word `vote` until a choice is written, and writing one is what replaces them, as writing a part replaces a round's choices. A vote's wall is its choices, so its standing piles are not seeded onto it and its note is never asked. The relay's read carries each round's `kind` as the leg holds it, empty when none was set, and the fields as they were written. A relay holding a vote with nothing to vote on — the leg's word is `vote`, the question offers no choice, and no take fills them: [voteStanding](computation:voteStanding) — is refused a launch with `NO_CHOICES`, from every screen, so the guard reads what the editor pressed rather than what the question holds. Every round leaves named groups with counts on its wall — piles for a write or list round, and for a vote round the choices with their tallies, since the wall page files each ballot under a pile of its choice's name, and a choice nobody chose becomes an empty pile the moment the pick names it. Which groups carry forward is the staff member's pick on the dashboard, made after the source round closes; nothing about the pick is authored. What a round does with the picked groups is its take's use, and the use is open only to some kinds:

| Use       | Kinds             | What it does when the round opens                                  |
| --------- | ----------------- | ------------------------------------------------------------------ |
| `context` | write, list, vote | the picked groups, with their cards, are shown above the prompt    |
| `choices` | vote              | the picked groups' names are the choices, and the round is one box |
| `parts`   | list              | the picked groups' names are the parts, one box each               |

[Live.relays.Uses](reaction:Live.relays.Uses) forms this table — [carryUses](computation:carryUses) — for the editor, its explainer, and the drafting passage, so the words have one home. Whether a use is open is read off the leg's word, and off the question's content only for a leg with no word ([useFit](computation:useFit)). A round that takes its choices or parts is authored with none of its own.

A question's parts are how one phone hands in several answers: labeled boxes (one, two, three) or one box repeated up to a cap. Each box is an item of its own, `question#n`, and each value handed in is one card on the wall. The shelf's questionnaire list leaves a round's questionnaire out, since a round is reached through its relay.

[Live.relays.List](reaction:Live.relays.List) forms [the relays](former:Live.relays.theRelays) — every relay, newest first, with its rounds as number and title, its open run and the round open in it when one stands, and the figure of that round (begun and handed in) — which is what the Live list shows beside the questionnaires. [Live.relays.Get](reaction:Live.relays.Get) forms [one relay whole](former:Live.relays.theRelay): each round with its questionnaire, question, prompt, parts, choices, and takes, its standing piles and its note to the sorter — which the rounds page owns — and the relay's runs, newest first, each with the rounds that ran in it and their figures.

## A run, and a run per round

[Live.relays.Launch](reaction:Live.relays.Launch) publishes the relay itself as an open edition — the run — and issues its share token and durable room code in the same request, exactly as a questionnaire launches. Nothing is captured at launch: the relay stays editable between rounds, and each round freezes only when it opens. A participant's token stays on the run for the whole meeting.

Opening a round is publishing a second time, with the round's questionnaire as the material. [Live.relays.OpenRound](reaction:Live.relays.OpenRound) opens a round, and [Live.relays.OpenRoundRefused](reaction:Live.relays.OpenRoundRefused) answers the same path with the refusals: `ROUND_OPEN` while another round of the run is open, `ROUND_DONE` when this round already ran in this run, `SOURCE_OPEN` while the round it takes from has not closed in this run, `NOTHING_PICKED` when it takes from a round on which nothing is picked, `CLOSED` once the run has closed, and `LEG_NOT_FOUND` for a round that is not the run's. A round whose source has closed may open whatever its number, so the staff member can skip or return; opening in order is the default the dashboard offers. Opening takes the run's Locking lock before it publishes: the lock is the run's "a round is open" held where one holder is the rule, so two dashboards that tap Open in one instant open one round and the other's request stops at the refused lock, which the wire answers as a conflict and the dashboard reads as `ROUND_OPEN` from the run as it then stands. [Live.relays.ClosedRoundUnlocksRun](reaction:Live.relays.ClosedRoundUnlocksRun) gives the lock back when the round closes, whichever path closed it. [Live.relays.Unlock](reaction:Live.relays.Unlock) gives it back by hand when a run is left locked with no round open — what a crash between the lock and the publish leaves behind — answering the run whether it was locked or not, and `ROUND_OPEN` while a round of it is open; the dashboard offers it as one deliberate tap and never sends it on its own, since a loser of the race that read the run before the winner's publish landed would unlock the winner. Opening then publishes the round and links it to its run through Linking, so the run knows its rounds in opening order; the tie is what captures: [Live.relays.TiedRoundCapturesPresentation](reaction:Live.relays.TiedRoundCapturesPresentation) captures the presentation into RunSnapshotting under the new edition, by the take's use — [the round's presentation](former:Live.relays.theRoundPresentation), the questionnaire as its kind selects it, for a round that takes nothing; [the presentation taking choices](former:Live.relays.theRoundPresentationTaking), with the choices replaced by the picked piles' names, their supporting cards shown as context, and no parts; [the presentation taking parts](former:Live.relays.theRoundPresentationTakingParts), with the parts replaced by the picked piles' names, their supporting cards shown as context, and no choices; or [the presentation showing the source](former:Live.relays.theRoundPresentationShowing), the question as its kind selects it with the picked piles and their cards — [pileCards](computation:pileCards) — as its context. All three carry forms read [the selected groups](former:Live.relays.theSelectedGroups), which joins the source wall's pins, category membership, submitted answers, and captured question in pick order. Dynamic choices additionally capture those groups as `choiceSources`: this explicit association distinguishes supporting examples from unrelated display context on a static vote. [pileCards](computation:pileCards) keeps written answers literally, including repeats; for a ballot it reads the original choice's supporting cards from that ballot question's immutable snapshot and includes each example once. Renaming or merging vote piles therefore carries the original examples identified by their ballots, not by a mutable pile name. Only the selected piles contribute; a later edit of the older source wall cannot rewrite the vote's captured history. A static or older vote without `choiceSources` carries no invented examples. An empty vote pile likewise carries its name and no examples: without a ballot there is no stable evidence of its original choice after renaming. The filled question lives only in that snapshot; the questionnaire itself is never rewritten. Which piles a round carried out are the pins in the source round's scope, set by the wall page's pick and read by the wall as the small tag on a pile.

[Live.relays.CloseRound](reaction:Live.relays.CloseRound) closes the round's edition; phones that answer afterward meet the same `CLOSED` refusal a closed quiz gives. [Live.relays.Close](reaction:Live.relays.Close) closes the run, closing its open round first when one stands. [Live.relays.ClosedRunClosesRounds](reaction:Live.relays.ClosedRunClosesRounds) closes any open rounds linked when the parent closes; [Live.relays.RoundTiedToClosedRunCloses](reaction:Live.relays.RoundTiedToClosedRunCloses) closes one linked afterward. Together they cover opening and closing that overlap between publishing and linking. Closure converges through reactions in the running engine; these actions are not a crash-atomic transaction. Showing a closed round again is a read of its wall, never a change of state.

[Live.relays.Run](reaction:Live.relays.Run) forms [the run](former:Live.relays.theRelayRun): the relay's title, whether the run is open, its token and code, and every round with its number, title, and — when it ran in this run — its edition and [its figure](former:Live.relays.theRoundFigure): whether it is open, when it opened and closed, and how many responses were begun and handed in. The dashboard and the projector poll this while the run is open.

## The model participant

Seats live on the runs page now: `Live.runs.Invite` takes one, `Live.runs.Dismiss` gives it up, and the runs page states what a seat is and what the two endpoints refuse. On a relay run the seat is answered round by round: [Live.relays.SeatedParticipantAnswersOpenRound](reaction:Live.relays.SeatedParticipantAnswersOpenRound) begins the new seat's response to the round open at that moment, and [Live.relays.CapturedRoundSeatsParticipants](reaction:Live.relays.CapturedRoundSeatsParticipants) begins a response for every seat still standing once a round's presentation is captured, so the seats invited on round one answer round two without a second invitation. From the begin on, the wall page's reactions and the participant worker hand the model's response in exactly as a phone would, on the participant's own clock. The run's read carries the seats standing, in the order they were taken, the round's figure how many of its hand-ins were the model's and how many of its seats nothing is coming for — a seat whose ask failed with no reply after, which the Model row says as not answering rather than writing — and the wall marks the model's cards; that mark is the only trace on any wall.

"Model sorts" is the run's switch, the same on every dashboard and readable by the projector: a Pinning pin of the run in the reserved scope `sorting`, set by [Live.relays.SortByModel](reaction:Live.relays.SortByModel) and cleared by [Live.relays.SortByHand](reaction:Live.relays.SortByHand), each answering the switch as it then stands and refusing `CLOSED` once the run has closed. The run's read carries it as `modelSorts`. A staff member who flips it flips it for the room; the wall page's cadence still runs from whichever dashboards are open, so a run with no dashboard open is not sorted.

## What a phone meets

The participation page owns the phone's endpoints; this page owns what they read for a relay. [The face of a relay run](former:Live.relays.theRelayFace) is what Arrive forms when the token opens onto a run whose material is a relay: the relay's title, whether the run is open, its rounds as number, title, and standing — done, open, or next — and the open round's edition and its question, with prompt, parts, and choices only. A phone begins a response to the open round, answers each part as an item of its own, and hands in; the round's edition is its subject, so the guards that refuse a closed run refuse a round that is not open.

```computations
oneBoxParts(question: String) : Strings
  Answers the parts of a round that offers carried choices: none, since such a
  round is one box.

oneBoxCap(question: String) : Number
  Answers the cap of a round that offers carried choices: none.

noChoices(question: String) : Strings
  Answers the choices of a round that takes its parts: none.

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

useStanding(use: String) : String
  Answers `known` when the word names a use this composition fills, and
  `unknown` otherwise.

voteStanding(kind: String, choices: Strings) : String
  Answers `bare` when the kind is `vote` and the round offers no choice of its
  own, and `filled` otherwise; whether a take fills the choices is the view's
  to read.

useFit(use: String, kind: String, choices: Strings, parts: Strings) : String
  Answers `open` when the use is one the leg's word may carry, or, for a leg
  with no word, one the kind its choices and parts make may carry, or when
  such a leg holds neither and the take is what makes it a kind; `closed` when
  the table shuts it to that kind; and `unknown` when the word names no use.

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
Live.relays.OpenRoundRefused at /live/relays/open-round
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
Live.relays.Unlock at /live/relays/unlock
Live.relays.Uses at /live/relays/uses
```
