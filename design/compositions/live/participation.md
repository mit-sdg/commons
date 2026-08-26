# Participation

A participant needs nothing but the token: no account, no roster seat, no
login. Scanning the code or typing the short address lands on the join page,
which calls these endpoints. Identity is hybrid: every device mints and keeps
a participant identifier, and when a Commons session rides along, the response
is bound to that account instead — so a signed-in student's participation
follows them across devices while an anonymous phone still counts.

[Live.participation.Arrive](reaction:Live.participation.Arrive) opens the
token through Sharing — a mistyped token is refused with Sharing's own
sentence — and forms [the face of the run](former:Live.participation.theParticipantFace):
its title, whether it is open, and its questions with prompt and choices only.
Pre-submission concealment has that one home; expected answers and
explanations are never formed there.

[Live.participation.Begin](reaction:Live.participation.Begin) starts — or
rejoins — an anonymous response under the device identifier, and
[Live.participation.BeginSigned](reaction:Live.participation.BeginSigned) does
the same under the caller's account when a session rides the request; the join
page calls whichever matches its login state. Responding holds one response
per participant and run, so a reloaded phone finds its answers standing, and a
participant who already handed in is refused rather than counted twice. A
closed run answers `CLOSED` before anything begins.

[Live.participation.Answer](reaction:Live.participation.Answer) records one
value per question, replacing in place; a question outside the run answers
`NOT_PART`, and a closed run answers `CLOSED`.
[Live.participation.Submit](reaction:Live.participation.Submit) is the
deliberate hand-in. A survey may be handed in as it stands; a quiz must answer
every question, else `INCOMPLETE` — the branch reads the questionnaire's form,
so the rule is the same in the instant before and after the key lands.

After hand-in,
[Live.participation.SubmittedResponseIsGraded](reaction:Live.participation.SubmittedResponseIsGraded)
measures the response against the run's key, once; a survey has no key and the
reaction never fires. [Live.participation.Outcome](reaction:Live.participation.Outcome)
is what the participant's screen polls afterward: a survey answers a plain
receipt, and a quiz answers by the key's disclosure —
[the score alone](former:Live.participation.theScoreOutcome),
[the score with the expected answers](former:Live.participation.theAnswersOutcome), or
[everything including explanations](former:Live.participation.theExplanationsOutcome).
The score counts the key's expectations alone — only choice questions propose,
so a written answer widens neither the score nor what it is out of. At the
levels that reveal answers, the outcome also carries the written-answer
questions that keep a reference, each with the participant's answer beside it
and nothing judged right or wrong: a written answer is read against its
reference, never measured. The score arrives blank until grading lands, which
is why the screen polls. A response not yet handed in answers `NOT_SUBMITTED`.

```endpoints
Live.participation.Answer at /live/p/answer
Live.participation.Arrive at /live/p/arrive
Live.participation.Begin at /live/p/begin
Live.participation.BeginSigned at /live/p/begin-signed
Live.participation.Outcome at /live/p/outcome
Live.participation.Submit at /live/p/submit
```
