# Relays and their runs

A relay is a series of rounds a staff member runs in one meeting: each round is one question, answered on phones, and a later round can take what an earlier one produced — the piles the room's answers were sorted into become the next round's choices. The concept behind it, Relaying, speaks of legs and draws; every endpoint, former, and screen here says **round** and **takes**. A round is a leg; what a round takes from an earlier one is that leg's draw. Every endpoint on this page requires `live:host`.

## Authoring a relay

Each round's question is an ordinary questionnaire of the survey form holding exactly one question, so a round's title is its questionnaire's title and everything Questioning knows — prompts, choices, parts — is the round's. The relay holds the order and the takes. [Live.relays.Plan](reaction:Live.relays.Plan) plans an empty relay under a title, [Live.relays.Retitle](reaction:Live.relays.Retitle) renames it, and [Live.relays.Retire](reaction:Live.relays.Retire) retires it when its teaching life ends: a retired relay is refused a launch with `RELAY_RETIRED`, its runs stay readable, and retiring is refused with `RUN_OPEN` while a run is open. Retiring is a Trashing instance over relays, so the list and the relay both carry `retired`. [Live.relays.AddRound](reaction:Live.relays.AddRound) composes the round's questionnaire, adds its one question, sets the question's parts, and appends the leg — one request, so a half-made round never stands. [Live.relays.ReviseRound](reaction:Live.relays.ReviseRound) rewrites a round in place: it clears the question's parts, revises the prompt and choices, and sets the parts again, in that order, so a round may move from choices to parts or back in one request; [Live.relays.ReviseRoundRefused](reaction:Live.relays.ReviseRoundRefused) answers the same path with `RUN_OPEN` for a round whose questionnaire has an open run, and `LEG_NOT_FOUND` for a round that does not exist, before anything changes. [Live.relays.RemoveRound](reaction:Live.relays.RemoveRound) removes the leg — Relaying refuses while another round still takes from it — and retires its questionnaire so the shelf never shows it as a survey of its own. [Live.relays.MoveRound](reaction:Live.relays.MoveRound) places a round at a position, and Relaying refuses any order that would put a round before what it takes from. [Live.relays.SetTakes](reaction:Live.relays.SetTakes) records what a round takes from an earlier one — a source round and a use — and [Live.relays.ClearTakes](reaction:Live.relays.ClearTakes) removes it; a use this composition does not fill, or one the table below shuts to the round's kind — [useFit](computation:useFit) — is refused `INVALID_USE`. Every write to a retired relay — retitling it, adding, revising, removing, or moving a round, setting or clearing what a round takes — is refused `RELAY_RETIRED`.

## Kinds and uses

A round is one of three kinds, read off its question: **write** (one box), **list** (parts: labeled boxes, or one box repeated up to a cap), or **vote** (choices). Every round leaves named groups with counts on its wall — piles for a write or list round, and for a vote round the choices with their tallies, since the wall page files each ballot under a pile of its choice's name. Which groups carry forward is the staff member's pick on the dashboard, made after the source round closes; nothing about the pick is authored. What a round does with the picked groups is its take's use, and the use is open only to some kinds:

| Use       | Kinds             | What it does when the round opens                                  |
| --------- | ----------------- | ------------------------------------------------------------------ |
| `context` | write, list, vote | the picked groups, with their cards, are shown above the prompt    |
| `choices` | vote              | the picked groups' names are the choices, and the round is one box |
| `parts`   | list              | the picked groups' names are the parts, one box each               |

[Live.relays.Uses](reaction:Live.relays.Uses) forms this table — [carryUses](computation:carryUses) — for the editor, its explainer, and the drafting passage, so the words have one home. A round that takes its choices or parts is authored with none of its own.

A question's parts are how one phone hands in several answers: labeled boxes (one, two, three) or one box repeated up to a cap. Each box is an item of its own, `question#n`, and each value handed in is one card on the wall. The shelf's questionnaire list leaves a round's questionnaire out, since a round is reached through its relay.

[Live.relays.List](reaction:Live.relays.List) forms [the relays](former:Live.relays.theRelays) — every relay, newest first, with its rounds as number and title, its open run and the round open in it when one stands, and the figure of that round (begun and handed in) — which is what the Live list shows beside the questionnaires. [Live.relays.Get](reaction:Live.relays.Get) forms [one relay whole](former:Live.relays.theRelay): each round with its questionnaire, question, prompt, parts, choices, and takes, and the relay's runs, newest first, each with the rounds that ran in it and their figures.

## A run, and a run per round

[Live.relays.Launch](reaction:Live.relays.Launch) publishes the relay itself as an open edition — the run — and issues its share token and durable room code in the same request, exactly as a questionnaire launches. Nothing is captured at launch: the relay stays editable between rounds, and each round freezes only when it opens. A participant's token stays on the run for the whole meeting.

Opening a round is publishing a second time, with the round's questionnaire as the material. [Live.relays.OpenRound](reaction:Live.relays.OpenRound) opens a round, and [Live.relays.OpenRoundRefused](reaction:Live.relays.OpenRoundRefused) answers the same path with the refusals: `ROUND_OPEN` while another round of the run is open, `ROUND_DONE` when this round already ran in this run, `SOURCE_OPEN` while the round it takes from has not closed in this run, `NOTHING_PICKED` when it takes from a round on which nothing is picked, `CLOSED` once the run has closed, and `LEG_NOT_FOUND` for a round that is not the run's. A round whose source has closed may open whatever its number, so the staff member can skip or return; opening in order is the default the dashboard offers. Opening publishes the round and links it to its run through RoundLinking, so the run knows its rounds in opening order; the tie is what captures: [Live.relays.TiedRoundCapturesPresentation](reaction:Live.relays.TiedRoundCapturesPresentation) captures the presentation into RunSnapshotting under the new edition, by the take's use — [the round's presentation](former:Live.relays.theRoundPresentation), the questionnaire as it stands, for a round that takes nothing; [the presentation taking choices](former:Live.relays.theRoundPresentationTaking), with the choices replaced by the picked piles' names and no parts; [the presentation taking parts](former:Live.relays.theRoundPresentationTakingParts), with the parts replaced by the picked piles' names and no choices; or [the presentation showing the source](former:Live.relays.theRoundPresentationShowing), the question as authored with the picked piles and their cards — [pileCards](computation:pileCards) — as its context. The filled question lives only in that snapshot; the questionnaire itself is never rewritten. Which piles a round carried out is the source round's PickLinking record, set by the wall page's pick and read by the wall as the small tag on a pile.

[Live.relays.CloseRound](reaction:Live.relays.CloseRound) closes the round's edition; phones that answer afterward meet the same `CLOSED` refusal a closed quiz gives. [Live.relays.Close](reaction:Live.relays.Close) closes the run, closing its open round first when one stands. Showing a closed round again is a read of its wall, never a change of state.

[Live.relays.Run](reaction:Live.relays.Run) forms [the run](former:Live.relays.theRelayRun): the relay's title, whether the run is open, its token and code, and every round with its number, title, and — when it ran in this run — its edition and [its figure](former:Live.relays.theRoundFigure): whether it is open, when it opened and closed, and how many responses were begun and handed in. The dashboard and the projector poll this while the run is open.

## The model participant

A model participant holds a seat in the run. [Live.relays.Invite](reaction:Live.relays.Invite) takes one seat per request, under a participant identity the dashboard minted and marked as the model's, by subscribing that participant to the run in Seating; the dashboard sends as many requests as seats were asked for, before the first round or between rounds as readily as during one. A seat follows the run: [Live.relays.SeatedParticipantAnswersOpenRound](reaction:Live.relays.SeatedParticipantAnswersOpenRound) begins the new seat's response to the round open at that moment, and [Live.relays.CapturedRoundSeatsParticipants](reaction:Live.relays.CapturedRoundSeatsParticipants) begins a response for every seat of the run once a round's presentation is captured, so the seats invited on round one answer round two without a second invitation. From the begin on, the wall page's reactions and the participant worker hand the model's response in exactly as a phone would, on the participant's own clock. [Live.relays.Dismiss](reaction:Live.relays.Dismiss) drops one seat and [Live.relays.DismissAll](reaction:Live.relays.DismissAll) every seat; a dismissed seat is reached by no later round, and what it already handed in stays on the wall. Inviting into a closed run is refused with `CLOSED`. The run's read carries the seats, in the order they were taken, and the round's figure how many of its hand-ins were the model's; the only trace on any wall is the small mark on the model's cards. The mark is the dashboard's to give: a phone that arrives through the share token wearing it is refused `FORBIDDEN`.

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

carryUses() : Json
  Answers the table of uses: each use, the kinds it is open to, and the one
  sentence the editor shows beside it.

useStanding(use: String) : String
  Answers `known` when the word names a use this composition fills, and
  `unknown` otherwise.

useFit(use: String, choices: Strings, parts: Strings) : String
  Answers `open` when the use is one the round's kind, read off its choices and
  parts, may carry, or when the round holds neither and the take is what makes
  it a kind; `closed` when the table shuts it to the kind the round's choices
  or parts already make it; and `unknown` when the word names no use.

pileCards(pile: String, categories: Json, values: Json) : Strings
  Answers the values of a pile's cards in hand-in order, leaving out a card
  that only repeats the pile's name, which is what a ballot does.
```

```endpoints
Live.relays.AddRound at /live/relays/add-round
Live.relays.ClearTakes at /live/relays/clear-takes
Live.relays.Close at /live/relays/close
Live.relays.CloseRound at /live/relays/close-round
Live.relays.Dismiss at /live/relays/dismiss
Live.relays.DismissAll at /live/relays/dismiss-all
Live.relays.Get at /live/relays/get
Live.relays.Invite at /live/relays/invite
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
Live.relays.SetTakes at /live/relays/set-takes
Live.relays.Uses at /live/relays/uses
```
