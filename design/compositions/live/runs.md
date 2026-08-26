# Live runs

A run is one live release of a questionnaire: launched at the start of a
meeting, joined by whoever holds its token, closed when the moment has passed.
Every run endpoint requires `live:host`.

[Live.runs.Launch](reaction:Live.runs.Launch) publishes an open edition fixed
to the questionnaire and issues its share token in the same request, so the
caller walks away holding everything the room needs — the token renders as a
QR code and a short address in the browser, a floor concern that appears
nowhere in this design. A quiz launches only once at least one question
proposes an expected answer; otherwise the caller receives `NOT_QUIZ_READY`.
Publishing refuses a second open run of the same questionnaire, so which run
is the live one is never in question.

After a quiz is published,
[Live.runs.PublishedQuizEstablishesKey](reaction:Live.runs.PublishedQuizEstablishesKey)
establishes the run's key whole — every expectation together with the authored
disclosure — before any participant can present the token, because the token
is issued only after the same publish occurrence. The standard therefore
exists before anyone is measured, and later edits to the questionnaire never
reach a run already launched. A survey publishes without a key and is never
graded.

[Live.runs.Close](reaction:Live.runs.Close) closes the run; a late scanner
finds it closed rather than quietly different, and closing twice is refused by
Publishing.

[Live.runs.OpenRuns](reaction:Live.runs.OpenRuns) forms
[the open runs](former:Live.runs.theOpenRuns) — every run currently live, with
its questionnaire and token — which is how the staff surface says what is
active right now. [Live.runs.Results](reaction:Live.runs.Results) forms
[the board of one run](former:Live.runs.theRunBoard): counts of responses
begun and handed in, and each question with every handed-in value — nothing
counts until a participant deliberately submits. For a keyed run it also forms
[the scores](former:Live.runs.theRunScores) in grading order. The staff
surface polls this endpoint while the run is open; that cadence is the
frontend's business.

```endpoints
Live.runs.Close at /live/runs/close
Live.runs.Launch at /live/runs/launch
Live.runs.OpenRuns at /live/runs/open
Live.runs.Results at /live/runs/results
```
