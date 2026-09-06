# What a round carries besides its question

A round's question is frozen when the round opens; two things a staff member authors beside it are not part of the question at all, and a third thing, the sample, is asked of the model about the round and kept only in Reasoning's record. Its **standing piles** are the piles that should stand on its wall before the room answers, and its **note to the sorter** is what whoever sorts that wall reads first. Both live on the round's leg, not on its questionnaire: the piles are Categorizing categories whose scope is the leg, and the note is Guiding guidance on the leg under the use `sorting`. Every endpoint here requires `live:host`, and every write to a round of a retired relay is refused `RELAY_RETIRED`.

## Standing piles

[Live.rounds.AddPile](reaction:Live.rounds.AddPile) names a pile on a round and describes it in one sentence, [Live.rounds.RenamePile](reaction:Live.rounds.RenamePile) renames it, [Live.rounds.DescribePile](reaction:Live.rounds.DescribePile) rewrites its sentence, and [Live.rounds.RemovePile](reaction:Live.rounds.RemovePile) takes it off the round. The piles are held to the same rule as the rest of the round: each is refused `RUN_OPEN` once the round has opened in a run, since by then the wall has its own piles. A pile that stands on no round — a wall's pile, or none at all — is refused `NOT_FOUND`, so the wall page's piles are never written through this page. A pile's description is the one sentence that explains its contents on sight, which is what the lid is: Summarize writes the model's sentence over it on the wall, so a standing pile's sentence is its lid at birth.

When the round's presentation is captured at open, [Live.rounds.CapturedRoundSeedsStandingPiles](reaction:Live.rounds.CapturedRoundSeedsStandingPiles) ensures each standing pile on the round's wall with its name and its sentence, so the wall opens with the piles already standing, empty, and the sorter's passage lists them like any pile. The relay's read carries each round's piles and its note, so the editor shows them beside the question.

## The note to the sorter

The note here is the relay's: what the editor writes before class, standing on the leg so every run of the relay reads it. [Live.rounds.SetNotes](reaction:Live.rounds.SetNotes) sets it as the one entry of guidance on the leg under `sorting`, so two hands writing at once leave one note, the later words standing; [Live.rounds.ClearNotes](reaction:Live.rounds.ClearNotes) removes it, answering whether one stood to be cleared. Neither is refused while the round is open in a run: the wall page's asks read the note on every ask, so a note revised between asks reaches the next one, unlike the question, which is frozen at capture. A note with nothing in it is refused by Guiding itself as `INVALID_GUIDANCE`; the editor clears the note instead of writing an empty one. The dashboard writes nothing here: what a hand types in the Sorting panel during a run is the run's note, guidance on the round's edition, which the wall page owns and which is read after the relay's; the sampling passage below reads the leg's alone.

## The sample

While a staff member writes a round, the phone beside it can show what a room might say and how it would sort. [Live.rounds.SampleAnswers](reaction:Live.rounds.SampleAnswers) makes one deliberate ask about the round's leg with [the sampling passage](computation:samplingPassage): a variant of the placing contract that keeps its rules about piles but writes the cards itself — one answer per stance of the participant passage, twelve in all, each placed as it is written — over the round's question as the phone would put it, its standing piles with their sentences, and its note to the sorter, so the prompt and the note both shape the sample. A round that takes from an earlier one is sampled after its source: [samplingPassageTaking](computation:samplingPassageTaking) puts the source's [sampled groups](computation:sampledGroups) where the take puts the picked piles, as the choices, as the boxes, or as the groups shown above the question. Their written answers accompany the names as explicitly synthetic supporting examples; a vote supplies only names because its ballots are not the original scenarios. A source with no sample yet refuses the ask `SOURCE_UNSAMPLED` rather than asking with placeholders. While an ask is out a second press asks nothing, and a round of a retired relay is refused `RELAY_RETIRED`.

The sample is durable through Reasoning's own record and nothing else: no reaction reads the reply, nothing is adopted, and no state of its own is kept. [Live.rounds.ReadSample](reaction:Live.rounds.ReadSample) forms [the sample of the round](former:Live.rounds.theSampleOf) from the newest reply about the leg — its answers with their piles, [sampledAnswers](computation:sampledAnswers), and whether it is `fresh` or `stale`, [sampleStanding](computation:sampleStanding), which holds exactly while the passage the round would make now is the one that was asked — together with whether an ask is still out and the newest failure about the leg, so the editor can wait, show, dim, or say the model is not answering. Asking again is what replaces a sample. A reply the reading cannot make out is a sample of no answers; the editor says so and offers the ask again.

```computations
samplingPassage(prompt: String, choices: Json, parts: Json, cap: Number, piles: Json, notes: String) : String
  Renders the passage that samples a round taking nothing: the pile rules the
  placing contract shares, the question as written with its choices or boxes,
  the author's note when one stands, the standing piles with their sentences,
  and the twelve stances, one answer each.

samplingPassageTaking(prompt: String, choices: Json, parts: Json, cap: Number, piles: Json, notes: String, use: String, carried: Json) : String
  Renders the same passage for a round that takes from an earlier one, with
  the carried names as the choices, as the boxes, or as the groups shown
  above the question, by the use the take names. The groups' written cards
  supply explicitly synthetic supporting examples for every use.

unsampledNames(use: String) : Json
  Answers no names at all, which is what a round carries from a source that
  has no sample yet, so its passage names nothing it could be asked with.

sampleStanding(asked: String, passage: String) : String
  Answers `fresh` while the passage a sample was asked with is the one the
  round would make now, and `stale` once anything it read has moved.

sampledAnswers(reply: String) : Json
  Reads a sampled reply into `{ value, pile }` pairs, dropping an answer with
  no value or no pile, and answers an empty sequence when the reply cannot be
  read.

sampledGroups(reply: String, kind: String, choices: Json, use: String) : Json
  Groups sampled answers as `{ name, cards }` in first-seen pile order.
  Written answers remain in their original order; vote groups have no cards,
  because ballot labels do not describe the scenarios behind their choices.
  A legacy round with no explicit kind is a vote when it offers or takes choices.

sampledPiles(reply: String) : Json
  Answers the piles a sampled reply names, each once, in the order they are
  first placed in.
```

```endpoints
Live.rounds.AddPile at /live/rounds/add-pile
Live.rounds.ClearNotes at /live/rounds/clear-notes
Live.rounds.DescribePile at /live/rounds/describe-pile
Live.rounds.ReadSample at /live/rounds/sample
Live.rounds.RemovePile at /live/rounds/remove-pile
Live.rounds.RenamePile at /live/rounds/rename-pile
Live.rounds.SampleAnswers at /live/rounds/sample-answers
Live.rounds.SetNotes at /live/rounds/set-notes
```

When an authored pile seeds a run, it is pinned under the reserved `live-reserved-piles` scope. This reservation belongs to the live pile identity and survives renaming. It is separate from the round-scope pins that select downstream input.
