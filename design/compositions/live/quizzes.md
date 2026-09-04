# Quizzes and surveys

A questionnaire is authored by hand here, whatever its origin: a staff member
holding `live:host` composes a quiz or a survey, adds and revises questions,
and retires the questionnaire when its teaching life ends. A questionnaire that
arrived through the drafting line is edited through exactly these operations —
adoption hands it over and nothing distinguishes it afterward — and any
questionnaire can be taken back up in plain language through a refining line
(see the drafting page), which applies its adopted revision under the same
rules that govern editing here.

[Live.quizzes.Create](reaction:Live.quizzes.Create) composes a questionnaire
with a title, a form — `quiz` or `survey` — and, for a quiz, the disclosure
level participants will meet afterward: `score`, `answers`, or `explanations`,
each revealing everything the previous level does. What a participant learns
afterward is part of composing the questionnaire, so disclosure is authored
here and frozen into the run's key at launch.
[Live.quizzes.Retitle](reaction:Live.quizzes.Retitle) and
[Live.quizzes.SetDisclosure](reaction:Live.quizzes.SetDisclosure) revise those
choices, and [Live.quizzes.Retire](reaction:Live.quizzes.Retire) moves the
questionnaire out of use while keeping it readable.

[Live.quizzes.AddQuestion](reaction:Live.quizzes.AddQuestion),
[Live.quizzes.ReviseQuestion](reaction:Live.quizzes.ReviseQuestion), and
[Live.quizzes.RemoveQuestion](reaction:Live.quizzes.RemoveQuestion) edit the
questions themselves: a prompt, offered choices (none means a written answer),
and for a quiz an optional expected answer with an optional explanation, empty
strings carrying none. On a question offering choices the expected answer
proposes one of them for grading; on a written-answer question it is a
reference revealed at the disclosure levels that show answers, and nothing is
ever graded against it. Questions stand contiguously in position order, counting
from one, and the composition keeps that so: adding appends at the end,
[Live.quizzes.RemovedQuestionClosesRanks](reaction:Live.quizzes.RemovedQuestionClosesRanks)
closes the ranks behind whatever was removed, revising changes content and
leaves the question's place alone, and
[Live.quizzes.RaiseQuestion](reaction:Live.quizzes.RaiseQuestion) and
[Live.quizzes.LowerQuestion](reaction:Live.quizzes.LowerQuestion) swap a
question with its neighbor — one request per move, so an interrupted reorder
never leaves the sheet half-written, and a question at its edge answers
`AT_EDGE`. Every mutating operation refuses with `RUN_OPEN` while
the questionnaire has an open run, so an audience mid-run never meets a
questionnaire that moved under them; Questioning's own refusals — an unknown
form or disclosure, a retired questionnaire, a missing question — stay in
force. A relay round's questionnaire is not one of these questionnaires: every
operation here, the read included, answers `QUESTIONNAIRE_NOT_FOUND` for one,
since a round is reached through its relay. Callers without the capability
receive `FORBIDDEN`.

[Live.quizzes.List](reaction:Live.quizzes.List) forms
[the questionnaires](former:Live.quizzes.theQuestionnaires) — every
questionnaire, newest first, each carrying its open run and share token when
one stands, its question count, and whether any question proposes an expected
answer, so every surface that offers Launch can decide readiness from the same
facts — and [Live.quizzes.Get](reaction:Live.quizzes.Get) forms
[one questionnaire whole](former:Live.quizzes.theQuestionnaire): its questions
in position order, expected answers included (this is the author's own desk),
and its runs, newest first.

```endpoints
Live.quizzes.AddQuestion at /live/quizzes/add-question
Live.quizzes.Create at /live/quizzes/create
Live.quizzes.Get at /live/quizzes/get
Live.quizzes.List at /live/quizzes/list
Live.quizzes.LowerQuestion at /live/quizzes/lower-question
Live.quizzes.RaiseQuestion at /live/quizzes/raise-question
Live.quizzes.RemoveQuestion at /live/quizzes/remove-question
Live.quizzes.Retire at /live/quizzes/retire
Live.quizzes.Retitle at /live/quizzes/retitle
Live.quizzes.ReviseQuestion at /live/quizzes/revise-question
Live.quizzes.SetDisclosure at /live/quizzes/set-disclosure
```
