# Participation

A participant needs nothing but the token: no account, no roster seat, no
login. Scanning the code or typing the short address lands on the join page,
which calls these endpoints. Identity is hybrid: every device mints and keeps
a participant identifier, and when a Commons session rides along, the response
is bound to that account instead — so a signed-in student's participation
follows them across devices while an anonymous phone still counts.

[Live.participation.Locate](reaction:Live.participation.Locate) accepts the
six-character room code, asks Locating for its run, and returns that run's
existing Sharing token. The code remains durable after closing, so following
an old classroom code reaches the ordinary closed-run participant state rather
than becoming an ambiguous missing page. Locating deliberately treats malformed
and unknown codes alike.

[Live.participation.Arrive](reaction:Live.participation.Arrive) opens the
token through Sharing — a mistyped token is refused with Sharing's own
sentence — and forms [the face of the run](former:Live.participation.theParticipantFace):
its title, whether it is open, and its questions with prompt and choices only.
Pre-submission concealment has that one home; expected answers and
explanations are never formed there. The captured title and form are projected
by [snapshotTitle](computation:snapshotTitle) and
[snapshotForm](computation:snapshotForm), while
[participantQuestions](computation:participantQuestions) deliberately removes
the captured standards and explanations.

When the token opens onto a relay run instead, Arrive forms the face of the
relay run, which the relays page owns — the rounds as number, title, and
standing, and the open round's question — under `relay` rather than `face`,
so the join page knows which kind of room it entered.

[Live.participation.Begin](reaction:Live.participation.Begin) starts — or
rejoins — an anonymous response under the device identifier, and
[Live.participation.BeginSigned](reaction:Live.participation.BeginSigned) does
the same under the caller's account when a session rides the request; the join
page calls whichever matches its login state. Responding holds one response
per participant and run, so a reloaded phone finds its answers standing, and a
participant who already handed in is refused rather than counted twice. The
anonymous endpoint takes only a device that names no account: a caller cannot
name a student and learn from the reply whether that student has begun, is
still answering, or has handed in, and cannot open a response in their name.
The same rule decides which identifiers may take a model's seat. A closed run answers `CLOSED` before anything begins. In a relay run both
endpoints begin the response to the round that is open, so a phone holds one
response per round under the same token, and a run with no round open answers
`NO_OPEN_ROUND`.

[Live.participation.Answer](reaction:Live.participation.Answer) records one
value per item, replacing in place; an item outside the run answers
`NOT_PART`, and a closed run answers `CLOSED`. A value is trimmed and a blank
one is refused with Responding's own sentence, so an empty box is never an
answer: nothing blank reaches the wall, and a quiz left blank is `INCOMPLETE`
rather than handed in empty. Membership is decided against
the run's captured presentation, so a later edit cannot add or remove a
question from an existing room. An item is a question, or one part of a
question with parts — `question#n` — so a phone answering three labeled
boxes records three answers, each a card on the wall.
[Live.participation.Submit](reaction:Live.participation.Submit) is the
deliberate hand-in. A survey may be handed in as it stands; a quiz must answer
every captured question, else `INCOMPLETE`. Both the form and completeness rule
come from the run snapshot, keeping participation on exactly the version the
room received.

Anonymous answer, hand-in, outcome, and wall requests accept only responses
whose participant is not an account. Their `Signed` counterparts require a live
session belonging to the response's account, so knowing another student's
response identifier grants no control over it and no reading of it:
[AnswerSigned](reaction:Live.participation.AnswerSigned),
[SubmitSigned](reaction:Live.participation.SubmitSigned), and
[OutcomeSigned](reaction:Live.participation.OutcomeSigned). The wall read below
carries the same rule.

The rule generalizes, and every participant endpoint added here is held to it:
a request that acts on a response, or that shows the holder anything about
themselves, decides ownership first. A read that identifies nobody may stay
open; the moment a read marks whose work is whose, an identifier alone is not
enough to make it answer.

What an anonymous participant holds is the response identifier itself, and that
is deliberate: a phone with no account has nothing else to prove it is the same
phone. So an anonymous response is only as private as its identifier, which
Commons issues at random and keeps on the device. The boundary that follows is
the one drawn above — an anonymous request reaches only responses that belong
to no account, so a capability that leaks costs its own holder and no one with
a login.

After hand-in,
[Live.participation.SubmittedResponseIsGraded](reaction:Live.participation.SubmittedResponseIsGraded)
measures the response against the run's key, once; a survey has no key and the
reaction never fires. [Live.participation.Outcome](reaction:Live.participation.Outcome)
is what the participant's screen polls afterward: a survey answers a plain
receipt, and a quiz answers by the key's disclosure —
[the score alone](former:Live.participation.theScoreOutcome),
[the score with an answer receipt](former:Live.participation.theAnswersOutcome), or
[everything including explanations](former:Live.participation.theExplanationsOutcome).
The score counts the key's expectations alone — only choice questions propose,
so a written answer widens neither the score nor what it is out of. At the
levels that reveal answers, the outcome carries one receipt row for each
submitted answer, in questionnaire order. Each row joins the prompt and the
participant's value to its feedback kind: a choice with a standard is graded,
a written answer with a standard is read against that reference, and an answer
without a standard is marked ungraded. Only the first kind is ever described
as right or wrong. The score arrives blank until grading lands, which
is why the screen polls. A response not yet handed in answers `NOT_SUBMITTED`. After handing in to a
round, [Live.participation.Wall](reaction:Live.participation.Wall) and
[Live.participation.WallSigned](reaction:Live.participation.WallSigned) read
the wall of that round, which the wall page owns, with the holder's own cards
marked, and nothing else identified — where you landed, shown only once
you have handed in; a response still in progress answers `NOT_SUBMITTED`.
Because the mark says which cards are the holder's, the wall read carries the
same ownership rule as the rest: a borrowed identifier answers `NOT_FOUND`.
The two revealing levels derive their ordered rows from the same immutable run
value with [answerReceipt](computation:answerReceipt) and
[explanationReceipt](computation:explanationReceipt); joining is a pure
calculation and adds no receipt state machine.

```endpoints
Live.participation.Answer at /live/p/answer
Live.participation.AnswerSigned at /live/p/answer-signed
Live.participation.Arrive at /live/p/arrive
Live.participation.Begin at /live/p/begin
Live.participation.BeginSigned at /live/p/begin-signed
Live.participation.Locate at /live/p/locate
Live.participation.Outcome at /live/p/outcome
Live.participation.OutcomeSigned at /live/p/outcome-signed
Live.participation.Submit at /live/p/submit
Live.participation.SubmitSigned at /live/p/submit-signed
Live.participation.Wall at /live/p/wall
Live.participation.WallSigned at /live/p/wall-signed
```
