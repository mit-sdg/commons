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
route behind the host capability. A relay round's questionnaire is launched by
opening its round, so Launch answers `QUESTIONNAIRE_NOT_FOUND` for one.
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
begun and handed in, each question — expected answer included, since the
board is the author's own desk — with every handed-in value, the seats standing
on the run, and every response a seat begun with whether it was handed in;
nothing counts until a participant deliberately submits. For a keyed run it also forms
[the scores](former:Live.runs.theRunScores) in grading order, each naming its
participant when a signed-in account stands behind it — an anonymous device
stays opaque. The staff
surface polls this endpoint while the run is open; that cadence is the
frontend's business.

## The model participant

A seat is a Subscribing subscription of a participant identity the dashboard
minted to the run, and a questionnaire run is answered whole, so a seat answers
the run itself the way a seat on a relay run answers a round.
[Live.runs.SeatedParticipantAnswersOpenRun](reaction:Live.runs.SeatedParticipantAnswersOpenRun)
begins the new seat's response to an open questionnaire run at once, the run
being the response's subject exactly as it is a phone's; a seat taken on a
relay run is begun by the relays page instead, round by round.
[Live.runs.BegunModelRunResponseAsksMind](reaction:Live.runs.BegunModelRunResponseAsksMind)
puts the run's captured presentation before Reasoning when a response to the
run begins under a participant that holds a seat on it — the same
[participantPassage](computation:participantPassage) a round is answered by,
which prints every question with its choices and its boxes, seeded by the
identity so the seats do not all say the same thing — and a phone's begin, which
holds no seat, asks nothing. The participant worker on the floor then plays the
phone for the run as it does for a round, finding the seat on the run itself
since a questionnaire run is linked to nothing.

[Live.runs.Invite](reaction:Live.runs.Invite) takes one seat per request, on a
questionnaire run and on a relay run alike; the dashboard sends as many requests
as seats were asked for. Inviting into a closed run is refused `CLOSED`, and a
seat identifier that names an account is refused `NOT_A_SEAT`: a seat is minted,
never borrowed from a person, so no host can seat a student and have that
student's answers read as the model's.
[Live.runs.Dismiss](reaction:Live.runs.Dismiss) dismisses one seat, and the
dashboard dismisses every seat the way it invited them, one request per seat.
Dismissing trashes the participant rather than dropping its seat, so no later
round reaches it and the run's read no longer lists it, while what it already
handed in stays marked as the model's — the mark is read from the seat, which
outlives the dismissal. Dismissing a participant that holds no seat on the run
is refused `NOT_SEATED`; dismissing one already dismissed changes nothing.

The board carries `seats`, the seats standing in the order they were taken, and
`modelResponses`, every response begun to the run under a participant that holds
a seat — dismissed or not — with whether it was handed in; the begun and
handed-in counts of the model, and which values on the board are the model's,
are read off that one list. A keyed run's scores mark each result `model`, the
way the wall marks a card, and a model's hand-in to a keyed quiz is graded like
any other, since the grading reaction fires on every submit to a keyed run.
Seats are for trying a run out, never for its scores, so a figure of the room
leaves the model's out; where each surface draws that line is the frontend's
business.

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
Live.runs.Dismiss at /live/runs/dismiss
Live.runs.Invite at /live/runs/invite
Live.runs.Launch at /live/runs/launch
Live.runs.LaunchForbidden at /live/runs/launch
Live.runs.OpenRuns at /live/runs/open
Live.runs.Results at /live/runs/results
```
