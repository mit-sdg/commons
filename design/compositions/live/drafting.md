# Drafting with the reasoner

A staff member holding `live:host` can begin a questionnaire by describing it
in plain language. The reasoner drafts it whole; the author reads, corrects in
the same plain language, answers a clarifying question when one comes back,
and finally adopts the candidate — at which point it becomes an ordinary
editable questionnaire and nothing else ever crosses from the drafting line
into the live domain.

[Live.drafting.Describe](reaction:Live.drafting.Describe) records the brief.
[Live.drafting.DescribedBriefAsksReasoner](reaction:Live.drafting.DescribedBriefAsksReasoner)
renders the drafting passage and puts it before the reasoner;
[Live.drafting.CorrectedBriefAsksReasoner](reaction:Live.drafting.CorrectedBriefAsksReasoner)
does the same for a correction, carrying the prior material so only what the
correction asks may change, and
[Live.drafting.ClarifiedBriefAsksReasoner](reaction:Live.drafting.ClarifiedBriefAsksReasoner)
resumes from the whole exchange once
[Live.drafting.Clarify](reaction:Live.drafting.Clarify) records the author's
answer. The reasoner itself is a name — a worker on the floor serves it, and
which model answers is deployment configuration.

Every reply meets a three-way reading that partitions it: a draft, a
clarifying question, or neither.
[Live.drafting.ReplyDraftProposes](reaction:Live.drafting.ReplyDraftProposes)
turns a draft reply into the brief's candidate;
[Live.drafting.ReplyQuestionAsks](reaction:Live.drafting.ReplyQuestionAsks)
records the clarifying question and sets the brief waiting — but only on a
brief that begins a line, because a correction's form was settled when the
line began, so
[Live.drafting.CorrectionQuestionComplains](reaction:Live.drafting.CorrectionQuestionComplains)
stands on a question that answers a correction as it would on any unusable
reply; and
[Live.drafting.ReplyNeitherComplains](reaction:Live.drafting.ReplyNeitherComplains)
stands on an unusable reply, opening an insistence of three complaints.
[Live.drafting.ComplaintRetriesTheAsk](reaction:Live.drafting.ComplaintRetriesTheAsk)
sends the exchange back — the original request, the exact reply, and the
account of what was wrong — while patience remains;
[Live.drafting.ProposedDraftSatisfiesInsistence](reaction:Live.drafting.ProposedDraftSatisfiesInsistence)
and
[Live.drafting.AskedQuestionSatisfiesInsistence](reaction:Live.drafting.AskedQuestionSatisfiesInsistence)
settle the insistence the moment a usable reply lands; and
[Live.drafting.SpentPatienceStallsTheBrief](reaction:Live.drafting.SpentPatienceStallsTheBrief)
stalls the brief honestly once patience is spent, closing the insistence. A
reasoner that could not be reached at all leaves nothing waiting silently:
[Live.drafting.FailedAskStallsTheBrief](reaction:Live.drafting.FailedAskStallsTheBrief)
stalls the brief with the failure's own account.

[Live.drafting.Correct](reaction:Live.drafting.Correct) opens the next step of
the line, and [Live.drafting.Line](reaction:Live.drafting.Line) forms
[the drafting line whole](former:Live.drafting.theDraftLine) — every step with
its request, its candidate's items, its open clarifications, whether it waits,
stalled, or stands adopted, and the questionnaire it refines or composed —
which the drafting surface polls while a reply is out.

[Live.drafting.Adopt](reaction:Live.drafting.Adopt) marks the candidate
adopted, and — for a line that began with a description —
[Live.drafting.AdoptedCandidateComposesQuestionnaire](reaction:Live.drafting.AdoptedCandidateComposesQuestionnaire)
composes the questionnaire from it: a privacy-safe generic title based on the
drafted form, `score` as the starting disclosure, each drafted item added as a
question in order, and the line's brief linked to what it composed, so the
drafting surface reads the questionnaire straight off the line rather than
watching the shelf for something new. From there the quizzes page owns it:
revision happens by hand, and correcting an adopted candidate is refused by
Drafting itself.

A questionnaire already on the shelf can be refined the same way.
[Live.drafting.Refine](reaction:Live.drafting.Refine) opens a drafting line on
the questionnaire as it stands — its questions become the line's first
candidate, no reasoner involved, and the questionnaire is the line's origin,
which Drafting itself carries through every correction. A correction on that
candidate then proceeds exactly as above. Opening a line is refused with
`RUN_OPEN` while the questionnaire has an open run, and with
`QUESTIONNAIRE_RETIRED` once it is retired.

Adopting a candidate of a refining line applies it back instead of composing
anew:
[Live.drafting.AdoptedRevisionRevisesQuestionnaire](reaction:Live.drafting.AdoptedRevisionRevisesQuestionnaire)
revises each question in place by position, sheds the questions past the
candidate's reach, and adds the items past the questionnaire's, so a question
that merely changed keeps its identity and the boards of closed runs keep
reading their answers. A refinement keeps the questionnaire's form — adoption
answers `FORM_FIXED` when the candidate proposes the other one — and is
refused with `RUN_OPEN` while a run stands open, the same rule the quizzes
page holds. The title and disclosure are not the line's to change; they stay
with the quizzes page that owns them.

A line, once left, can be found again.
[Live.drafting.Lines](reaction:Live.drafting.Lines) forms
[the author's drafting lines](former:Live.drafting.theDraftLines) — one row
per line the caller began, newest first, each saying whether it stands
adopted, stalled, or waiting on a clarification, what it was opened from, and,
when a description's adoption composed a questionnaire, which one — so the
drafting page can offer an interrupted line back.
[Live.drafting.Provenance](reaction:Live.drafting.Provenance) forms
[the drafting provenance of one questionnaire](former:Live.drafting.theProvenance):
the described line that composed it, when one did, and every refining line
opened on it, whoever opened it — how the questionnaire came to read as it
does. Both require `live:host`.

```endpoints
Live.drafting.Adopt at /live/drafts/adopt
Live.drafting.Clarify at /live/drafts/clarify
Live.drafting.Correct at /live/drafts/correct
Live.drafting.Describe at /live/drafts/describe
Live.drafting.Line at /live/drafts/line
Live.drafting.Lines at /live/drafts/lines
Live.drafting.Provenance at /live/drafts/provenance
Live.drafting.Refine at /live/drafts/refine
```
