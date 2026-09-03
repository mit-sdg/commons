# Relays and their runs

A relay is a series of rounds a staff member runs in one meeting: each round is one question, answered on phones, and a later round can take what an earlier one produced — the piles the room's answers were sorted into become the next round's choices. The concept behind it, Relaying, speaks of legs and draws; every endpoint, former, and screen here says **round** and **takes**. A round is a leg; what a round takes from an earlier one is that leg's draw. Every endpoint on this page requires `live:host`.

## Authoring a relay

Each round's question is an ordinary questionnaire of the survey form holding exactly one question, so a round's title is its questionnaire's title and everything Questioning knows — prompts, choices, parts — is the round's. The relay holds the order and the takes. [Live.relays.Plan](reaction:Live.relays.Plan) plans an empty relay under a title, and [Live.relays.Retitle](reaction:Live.relays.Retitle) renames it. [Live.relays.AddRound](reaction:Live.relays.AddRound) composes the round's questionnaire, adds its one question, sets the question's parts, and appends the leg — one request, so a half-made round never stands. [Live.relays.ReviseRound](reaction:Live.relays.ReviseRound) rewrites a round in place: it clears the question's parts, revises the prompt and choices, and sets the parts again, in that order, so a round may move from choices to parts or back in one request; [Live.relays.ReviseRoundRefused](reaction:Live.relays.ReviseRoundRefused) answers the same path with `RUN_OPEN` for a round whose questionnaire has an open run, and `LEG_NOT_FOUND` for a round that does not exist, before anything changes. [Live.relays.RemoveRound](reaction:Live.relays.RemoveRound) removes the leg — Relaying refuses while another round still takes from it — and retires its questionnaire so the shelf never shows it as a survey of its own. [Live.relays.MoveRound](reaction:Live.relays.MoveRound) places a round at a position, and Relaying refuses any order that would put a round before what it takes from. [Live.relays.SetTakes](reaction:Live.relays.SetTakes) records what a round takes from an earlier one — a source round and a shape — and [Live.relays.ClearTakes](reaction:Live.relays.ClearTakes) removes it. The shapes this composition fills are `picked` (the piles the staff member tapped on the source's wall), `every` (every pile), and `top` (the three fullest); each fills the round's choices when it opens.

A question's parts are how one phone hands in several answers: labeled boxes (one, two, three) or one box repeated up to a cap. Each box is an item of its own, `question#n`, and each value handed in is one card on the wall. The shelf's questionnaire list leaves a round's questionnaire out, since a round is reached through its relay.

[Live.relays.List](reaction:Live.relays.List) forms [the relays](former:Live.relays.theRelays) — every relay, newest first, with its rounds as number and title, its open run and the round open in it when one stands, and the figure of that round (begun and handed in) — which is what the Live list shows beside the questionnaires. [Live.relays.Get](reaction:Live.relays.Get) forms [one relay whole](former:Live.relays.theRelay): each round with its questionnaire, question, prompt, parts, choices, and takes, and the relay's runs, newest first.

## A run, and a run per round

[Live.relays.Launch](reaction:Live.relays.Launch) publishes the relay itself as an open edition — the run — and issues its share token and durable room code in the same request, exactly as a questionnaire launches. Nothing is captured at launch: the relay stays editable between rounds, and each round freezes only when it opens. A participant's token stays on the run for the whole meeting.

Opening a round is publishing a second time, with the round's questionnaire as the material. [Live.relays.OpenRound](reaction:Live.relays.OpenRound) opens a round, and [Live.relays.OpenRoundRefused](reaction:Live.relays.OpenRoundRefused) answers the same path with the refusals: `ROUND_OPEN` while another round of the run is open, `ROUND_DONE` when this round already ran in this run, `SOURCE_OPEN` while any round it takes from has not closed in this run, `NOTHING_PICKED` when it takes the picked piles and none are picked, `CLOSED` once the run has closed, and `LEG_NOT_FOUND` for a round that is not the run's. A round whose sources have closed may open whatever its number, so the staff member can skip or return; opening in order is the default the dashboard offers. When the round takes `every` or `top`, [Live.relays.OpenRoundCarrying](reaction:Live.relays.OpenRoundCarrying) answers the same path and first records the carried piles on the source round, so that `picked`, `every`, and `top` all read the same record. Then it publishes the round and links it to its run through RoundLinking, so the run knows its rounds in opening order; the tie is what captures: [Live.relays.TiedRoundCapturesPresentation](reaction:Live.relays.TiedRoundCapturesPresentation) captures the presentation into RunSnapshotting under the new edition — [the round's presentation](former:Live.relays.theRoundPresentation), the questionnaire as it stands, for a round that takes nothing, or [the presentation taking from a source round](former:Live.relays.theRoundPresentationTaking), with the choices replaced by the carried piles' names. The filled question lives only in that snapshot; the questionnaire itself is never rewritten. Which piles a round carried out is the source round's PickLinking record, set by the wall page's pick and read by the wall as the small tag on a pile.

[Live.relays.CloseRound](reaction:Live.relays.CloseRound) closes the round's edition; phones that answer afterward meet the same `CLOSED` refusal a closed quiz gives. [Live.relays.Close](reaction:Live.relays.Close) closes the run, closing its open round first when one stands. Showing a closed round again is a read of its wall, never a change of state.

[Live.relays.Run](reaction:Live.relays.Run) forms [the run](former:Live.relays.theRelayRun): the relay's title, whether the run is open, its token and code, and every round with its number, title, and — when it ran in this run — its edition and [its figure](former:Live.relays.theRoundFigure): whether it is open, when it opened and closed, and how many responses were begun and handed in. The dashboard and the projector poll this while the run is open.

## The model participant

[Live.relays.Invite](reaction:Live.relays.Invite) begins a response to the open round under a participant identity the dashboard minted and marked as the model's, one per request; the dashboard sends as many requests as seats were asked for. From there the wall page's reactions and the participant worker hand the model's response in exactly as a phone would, on the participant's own clock. The only trace on any read is the small mark on its cards.

## What a phone meets

The participation page owns the phone's endpoints; this page owns what they read for a relay. [The face of a relay run](former:Live.relays.theRelayFace) is what Arrive forms when the token opens onto a run whose material is a relay: the relay's title, whether the run is open, its rounds as number, title, and standing — done, open, or next — and the open round's edition and its question, with prompt, parts, and choices only. A phone begins a response to the open round, answers each part as an item of its own, and hands in; the round's edition is its subject, so the guards that refuse a closed run refuse a round that is not open.

```endpoints
Live.relays.AddRound at /live/relays/add-round
Live.relays.ClearTakes at /live/relays/clear-takes
Live.relays.Close at /live/relays/close
Live.relays.CloseRound at /live/relays/close-round
Live.relays.Get at /live/relays/get
Live.relays.Invite at /live/relays/invite
Live.relays.Launch at /live/relays/launch
Live.relays.List at /live/relays/list
Live.relays.MoveRound at /live/relays/move-round
Live.relays.OpenRound at /live/relays/open-round
Live.relays.OpenRoundCarrying at /live/relays/open-round
Live.relays.OpenRoundRefused at /live/relays/open-round
Live.relays.Plan at /live/relays/plan
Live.relays.RemoveRound at /live/relays/remove-round
Live.relays.Retitle at /live/relays/retitle
Live.relays.ReviseRound at /live/relays/revise-round
Live.relays.ReviseRoundRefused at /live/relays/revise-round
Live.relays.Run at /live/relays/run
Live.relays.SetTakes at /live/relays/set-takes
```
