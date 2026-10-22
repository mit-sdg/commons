# Drafting

## Purpose

Let a person who can say what they want receive a complete draft of it, ask for
corrections in the same plain language, and read every revision whole — so
making something begins with describing it, not composing it.

## Principle

Professor Lee describes a five-question beginner quiz in her own words and a
complete candidate comes back: five questions, choices, proposed answers. She
reads it, asks for the daily-watering question to be replaced with one about
soil moisture, and receives a revised candidate whose other questions are
untouched — with the earlier version still there to compare. When she instead
writes something that could equally be a survey or a quiz, drafting asks her
which she means rather than deciding for her. Satisfied at last, she adopts the
candidate and the line closes: correcting an adopted candidate is refused,
because what she took is now hers to change by hand. Returning later to a
worksheet she already owns, she opens a new line on it as it stands: the first
candidate carries the material she brought, not something drafted for her, and
the line remembers what it was opened from. Asking for corrections proceeds as
ever, every step of the line answering the same origin.

## Types

```types
external Author
  An application-owned identity used in the author role.

external Origin
  An application-owned identity for what a line was opened from.
opaque Seq
  An ordered list of the values its argument names.
opaque MaterialEntry
  One item of material as `{ prompt, choices, expected, explanation }`.
```

## State

```state
a set of Briefs with
  an author  Author
  a context  String
  a request  String
  a createdAt Date
  an optional basis Candidate
  an optional origin Origin

a set of Clarifying Briefs
a set of Stalled Briefs

a set of Clarifications with
  a brief    Brief
  a question String
  an optional answer String

a set of Candidates with
  a brief Brief
  a form  String
  a seq of Items

a set of Adopted Candidates

a set of Items with
  a prompt      String
  a choices     seq of String
  an expected    String
  an explanation String

Rule: each entry of propose's material is `{ prompt, choices, expected, explanation }`; choices may be empty, an empty expected or explanation carries none, and a candidate's items keep the entries' order under per-item identities the concept mints.
Rule: a brief holds at most one candidate, and a correction is a new brief whose basis is the candidate it corrects — the line of revisions is read through those bases.
Rule: a line opened on material in hand records what it was opened from as its origin, and a correction inherits the origin of the brief it continues, so every step of a line knows the same origin; a described line has none.
Rule: describe and open retain their opaque context (empty by default); correct inherits the prior brief's context. Drafting does not interpret context.
Rule: Drafting does not generate drafts, decide who is asked for one, or interpret what a draft means to the surrounding design; who reads a brief and answers it, and what adopting a candidate turns it into, are arranged outside the concept.
```

## Actions

```actions
describe (author: Author, request: String, at: Date, context?: String) : returns (brief: Brief)
  where true
  then
    add a new brief with author, request, context (empty if omitted), and createdAt at
    returns brief

open (author: Author, request: String, form: String, material: Seq<MaterialEntry>, origin: Origin, at: Date, context?: String) : returns (brief: Brief, candidate: Candidate)
  where true
  then
    add a new brief with author, request, context (empty if omitted), createdAt at, and origin
    add a new candidate with brief and form
    add a new item for each entry of material with its prompt, choices, expected,
      and explanation, appending it to candidate's items
    returns brief, candidate

correct (author: Author, candidate: Candidate, request: String, at: Date) : returns (brief: Brief)
  where candidate exists and candidate not in adopted
  then
    add a new brief with author, request, createdAt at, basis candidate, and
      the origin of candidate's brief
    returns brief
  where candidate does not exist
  then
    refuses CANDIDATE_NOT_FOUND "There is no such draft to correct."
  where candidate in adopted
  then
    refuses ALREADY_ADOPTED "This draft was already adopted; edit it directly instead."

propose (brief: Brief, form: String, material: Seq<MaterialEntry>) : returns (candidate: Candidate)
  where brief has no candidate and brief not in clarifying and brief not in stalled
  then
    add a new candidate with brief and form
    add a new item for each entry of material with its prompt, choices, expected,
      and explanation, appending it to candidate's items
    returns candidate
  where brief does not exist
  then
    refuses BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate
  then
    refuses ALREADY_DRAFTED "This request was already drafted; correct the draft instead."
  where brief in clarifying
  then
    refuses AWAITING_CLARIFICATION "This request is waiting on the author's clarification."
  where brief in stalled
  then
    refuses REQUEST_STALLED "This request stalled; describe it again."

ask (brief: Brief, question: String) : returns (clarification: Clarification)
  where brief has no candidate and brief not in stalled
  then
    add a new clarification with brief and question
    add brief to clarifying
    returns clarification
  where brief does not exist
  then
    refuses BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate
  then
    refuses ALREADY_DRAFTED "This request was already drafted; correct the draft instead."
  where brief in stalled
  then
    refuses REQUEST_STALLED "This request stalled; describe it again."

stall (brief: Brief, reason: String) : returns (brief: Brief)
  where brief has no candidate and brief not in stalled
  then
    add brief to stalled
    returns brief
  where brief does not exist
  then
    refuses BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate or brief in stalled
  then
    refuses NOT_AWAITING_DRAFT "This request is not waiting on a draft."

clarify (clarification: Clarification, answer: String) : returns (clarification: Clarification, brief: Brief)
  where clarification exists and clarification has no answer
  then
    set clarification's answer to answer
    remove clarification's brief from clarifying
    returns clarification, brief
  where clarification does not exist
  then
    refuses CLARIFICATION_NOT_FOUND "There is no such question."
  where clarification has answer
  then
    refuses ALREADY_ANSWERED "This question was already answered."

adopt (candidate: Candidate) : returns (candidate: Candidate)
  where candidate exists and candidate not in adopted
  then
    add candidate to adopted
    returns candidate
  where candidate does not exist
  then
    refuses CANDIDATE_NOT_FOUND "There is no such draft."
  where candidate in adopted
  then
    refuses ALREADY_ADOPTED "This draft was already adopted."
```

## Queries

```queries
_context (brief: String) : one (context: String)
  answers the opaque context saved on the brief, inherited on correction, or an empty string if absent

_brief (brief: String) : optional (author: String, request: String, createdAt: Date, basis: String|null)
  answers the complete Brief
  answers no row when the Brief does not exist

_briefs (author: String) : many (brief: String, request: String, createdAt: Date, basis: String|null)
  answers the author's briefs, newest first
  answers no rows when none match

_lines (author: String) : many (brief: String, request: String, createdAt: Date, origin: String|null, adopted: Flag, stalled: Flag, clarifying: Flag)
  answers the author's lines, newest first — one row per brief that begins a
  line, with what it was opened from and where the line now stands: a
  candidate adopted, its tip stalled, or a clarification waiting
  answers no rows when none match

_openedFrom (origin: String) : many (brief: String, author: String, request: String, createdAt: Date, adopted: Flag, stalled: Flag, clarifying: Flag)
  answers the briefs that began a line opened from origin, newest first, each
  with where the line now stands as _lines answers it
  answers no rows when none match

_standing (brief: String) : optional (clarifying: Flag, stalled: Flag)
  answers where the brief stands
  answers no row when the Brief does not exist

_originOf (brief: String) : optional (origin: String)
  answers what the brief's line was opened from
  answers no row when the brief has no origin or does not exist

_basisOf (brief: String) : optional (basis: String)
  answers the candidate the brief corrects
  answers no row when the brief is not a correction or does not exist

_rootOf (brief: String) : optional (root: String, request: String)
  answers the brief that began the line this brief continues — the brief
  itself when it begins one — together with that root's request
  answers no row when the Brief does not exist

_clarifications (brief: String) : many (clarification: String, question: String, answer: String|null)
  answers the brief's clarifications in asking order
  answers no rows when none match

_candidateOf (brief: String) : optional (candidate: String, form: String, adopted: Flag)
  answers the brief's candidate
  answers no row when none exists

_candidate (candidate: String) : optional (brief: String, form: String, adopted: Flag)
  answers the complete Candidate
  answers no row when the Candidate does not exist

_items (candidate: String) : many (item: String, prompt: String, choices: Seq<String>, expected: String, explanation: String, position: Number)
  answers the candidate's items in order, position counting from one
  answers no rows when none match

_material (candidate: String) : optional (form: String, material: Seq<MaterialEntry>)
  answers the candidate's items back as one value in the same entry shape
  propose accepts — material in, material out
  answers no row when the Candidate does not exist

_line (brief: String) : many (brief: String, request: String, basis: String|null, candidate: String|null, form: String|null, adopted: Flag)
  answers one row per brief in the line of intent — the given brief and every
  correction reachable through its candidates — in discovery order; a tip is a
  row whose candidate no later row revises
  answers no rows when the Brief does not exist
```
