# Live runs

A run is one live release of a questionnaire: launched at the start of a
meeting, joined by whoever holds its token, closed when the moment has passed.
Every run endpoint requires `live:host`.

[Live.runs.Launch](reaction:Live.runs.Launch) publishes an open edition fixed
to the questionnaire, captures its presentation, issues its share token, and
ensures its durable Locating code in the same request, so the caller walks away
holding everything the room needs. The long token renders as the QR destination;
the short code is what a participant can type. A quiz launches only once at least one question
proposes an expected answer — only a question offering choices proposes, so a
quiz of written-answer questions alone is not ready; otherwise the caller
receives `NOT_QUIZ_READY`.
Launch returns that refusal from the same presented version, while
[Live.runs.LaunchForbidden](reaction:Live.runs.LaunchForbidden) keeps the shared
route behind the host capability.
Publishing refuses a second open run of the same questionnaire, so which run
is the live one is never in question.

Before either participation address is issued, Launch asks Questioning to
`present` one coherent authored version. Presenting is serialized with edits but
does not publish or freeze the questionnaire. It returns the presentation and
its form, disclosure, readiness, and ordered expectations from that same read.
Launch passes the presentation whole into RunSnapshotting under the new edition.
Participant
faces, staff boards, and receipts therefore keep the released title, form, and
questions even after the questionnaire becomes editable for a later run.
The board reads the captured title and form with
[snapshotTitle](computation:snapshotTitle) and
[snapshotForm](computation:snapshotForm), then joins the captured questions to
submitted run values with [boardQuestions](computation:boardQuestions).

For a quiz, Launch next establishes the run's key from the disclosure and
expectations returned beside that exact presentation. A written answer's
reference never enters a key, so nothing is ever graded against it. Only after
the snapshot and key stand does Launch issue either address. The standard
therefore exists before anyone is measured, and a snapshot can never disagree
with its key. A survey publishes and captures without a key and is never graded.

[Live.runs.Close](reaction:Live.runs.Close) closes the run; a late scanner
finds it closed rather than quietly different, and closing twice is refused by
Publishing.

[Live.runs.OpenRuns](reaction:Live.runs.OpenRuns) forms
[the open runs](former:Live.runs.theOpenRuns) — every run currently live, with
its questionnaire, token, and room code — which is how the staff surface says what is
active right now. Its title and form also come from the run snapshot, so a
concurrent later edit cannot make the shelf disagree with the room.
[Live.runs.Results](reaction:Live.runs.Results) forms
[the board of one run](former:Live.runs.theRunBoard): its participation
addresses, counts of responses
begun and handed in, and each question — expected answer included, since the
board is the author's own desk — with every handed-in value; nothing counts
until a participant deliberately submits. For a keyed run it also forms
[the scores](former:Live.runs.theRunScores) in grading order, each naming its
participant when a signed-in account stands behind it — an anonymous device
stays opaque. The staff
surface polls this endpoint while the run is open; that cadence is the
frontend's business.

```computations
snapshotTitle(value: LiveRunSnapshot) : String
  Reads the captured questionnaire title.

snapshotForm(value: LiveRunSnapshot) : String
  Reads the captured questionnaire form.

snapshotHasQuestion(value: LiveRunSnapshot, question: String) : Boolean
  Says whether the captured presentation contains the item identity — a
  question, or one part of a question with parts.

snapshotIsWhole(value: LiveRunSnapshot, answers: Seq) : Boolean
  Says whether the answers include every captured item: each question without
  parts, each labeled part, and at least one repetition of a repeated box.

participantQuestions(value: LiveRunSnapshot) : Seq
  Projects ordered participant questions with prompt, choices, parts, and cap,
  without standards or explanations.

boardQuestions(value: LiveRunSnapshot, values: Seq) : Seq
  Enriches ordered captured questions with the run's submitted values, each
  value naming the part it answers.

answerReceipt(value: LiveRunSnapshot, answers: Seq) : Seq
  Joins submitted answers to captured questions without explanations.

explanationReceipt(value: LiveRunSnapshot, answers: Seq) : Seq
  Joins submitted answers to captured questions with explanations.
```

```endpoints
Live.runs.Close at /live/runs/close
Live.runs.Launch at /live/runs/launch
Live.runs.LaunchForbidden at /live/runs/launch
Live.runs.OpenRuns at /live/runs/open
Live.runs.Results at /live/runs/results
```
