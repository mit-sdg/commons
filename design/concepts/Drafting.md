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
because what she took is now hers to change by hand.

## Types

```types
external Author
  An application-owned identity used in the author role.
```

## State

```state
a set of Briefs with
  an author  Author
  a request  String
  a createdAt Date
  an optional basis Candidate

a Clarifying set of Briefs
a Stalled    set of Briefs

a set of Clarifications with
  a brief    Brief
  a question String
  an optional answer String

a set of Candidates with
  a brief Brief
  a form  String
  a seq of Items

an Adopted set of Candidates

a set of Items with
  a prompt      String
  a choices     Seq
  an expected    String
  an explanation String

Rule: each entry of propose's material is `{ prompt, choices, expected, explanation }`; choices may be empty, an empty expected or explanation carries none, and a candidate's items keep the entries' order under per-item identities the concept mints.
Rule: a brief holds at most one candidate, and a correction is a new brief whose basis is the candidate it corrects — the line of revisions is read through those bases.
Rule: Drafting does not generate drafts, decide who is asked for one, or interpret what a draft means to the surrounding design; who reads a brief and answers it, and what adopting a candidate turns it into, are arranged outside the concept.
```

## Actions

```actions
describe (author: Author, request: String, at: Date) : return (brief: Brief)
  where true
  then
    add a new brief with author, request, and createdAt at
    return brief

correct (author: Author, candidate: Candidate, request: String, at: Date) : return (brief: Brief)
  where candidate exists and candidate not in adopted
  then
    add a new brief with author, request, createdAt at, and basis candidate
    return brief
  where candidate does not exist
  then
    refuse CANDIDATE_NOT_FOUND "There is no such draft to correct."
  where candidate in adopted
  then
    refuse ALREADY_ADOPTED "This draft was already adopted; edit it directly instead."

propose (brief: Brief, form: String, material: Seq) : return (candidate: Candidate)
  where brief has no candidate and brief not in clarifying and brief not in stalled
  then
    add a new candidate with brief and form
    add a new item for each entry of material with its prompt, choices, expected,
      and explanation, appending it to candidate's items
    return candidate
  where brief does not exist
  then
    refuse BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate
  then
    refuse ALREADY_DRAFTED "This request was already drafted; correct the draft instead."
  where brief in clarifying
  then
    refuse AWAITING_CLARIFICATION "This request is waiting on the author's clarification."
  where brief in stalled
  then
    refuse REQUEST_STALLED "This request stalled; describe it again."

ask (brief: Brief, question: String) : return (clarification: Clarification)
  where brief has no candidate and brief not in stalled
  then
    add a new clarification with brief and question
    add brief to clarifying
    return clarification
  where brief does not exist
  then
    refuse BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate
  then
    refuse ALREADY_DRAFTED "This request was already drafted; correct the draft instead."
  where brief in stalled
  then
    refuse REQUEST_STALLED "This request stalled; describe it again."

stall (brief: Brief, reason: String) : return (brief: Brief)
  where brief has no candidate and brief not in stalled
  then
    add brief to stalled
    return brief
  where brief does not exist
  then
    refuse BRIEF_NOT_FOUND "There is no such request."
  where brief has a candidate or brief in stalled
  then
    refuse NOT_AWAITING_DRAFT "This request is not waiting on a draft."

clarify (clarification: Clarification, answer: String) : return (clarification: Clarification, brief: Brief)
  where clarification exists and clarification has no answer
  then
    set clarification's answer to answer
    remove clarification's brief from clarifying
    return clarification, brief
  where clarification does not exist
  then
    refuse CLARIFICATION_NOT_FOUND "There is no such question."
  where clarification has answer
  then
    refuse ALREADY_ANSWERED "This question was already answered."

adopt (candidate: Candidate) : return (candidate: Candidate)
  where candidate exists and candidate not in adopted
  then
    add candidate to adopted
    return candidate
  where candidate does not exist
  then
    refuse CANDIDATE_NOT_FOUND "There is no such draft."
  where candidate in adopted
  then
    refuse ALREADY_ADOPTED "This draft was already adopted."
```

## Queries

```queries
_brief (brief: String) : optional (author: String, request: String, createdAt: Date, basis: String|Null)
  answers the complete Brief
  answers no row when the Brief does not exist

_briefs (author: String) : many (brief: String, request: String, createdAt: Date, basis: String|Null)
  answers the author's briefs, newest first
  answers no rows when none match

_standing (brief: String) : optional (clarifying: Boolean, stalled: Boolean)
  answers where the brief stands
  answers no row when the Brief does not exist

_clarifications (brief: String) : many (clarification: String, question: String, answer: String|Null)
  answers the brief's clarifications in asking order
  answers no rows when none match

_candidateOf (brief: String) : optional (candidate: String, form: String, adopted: Boolean)
  answers the brief's candidate
  answers no row when none exists

_candidate (candidate: String) : optional (brief: String, form: String, adopted: Boolean)
  answers the complete Candidate
  answers no row when the Candidate does not exist

_items (candidate: String) : many (item: String, prompt: String, choices: Seq, expected: String, explanation: String, position: Number)
  answers the candidate's items in order, position counting from one
  answers no rows when none match

_material (candidate: String) : optional (form: String, material: Seq)
  answers the candidate's items back as one value in the same entry shape
  propose accepts — material in, material out
  answers no row when the Candidate does not exist

_line (brief: String) : many (brief: String, request: String, basis: String|Null, candidate: String|Null, form: String|Null, adopted: Boolean)
  answers one row per brief in the line of intent — the given brief and every
  correction reachable through its candidates — in discovery order; a tip is a
  row whose candidate no later row revises
  answers no rows when the Brief does not exist
```
