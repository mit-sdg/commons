# Responding

## Purpose

Let a participant answer what they were given at their own pace and hand it in
deliberately, once — nothing counts until they say it does.

## Principle

Leon begins a response to the quiz and answers three of five questions. He
skips one, comes back to it, and changes an earlier answer — nothing has
counted yet. His phone reloads mid-lecture; beginning again finds the response
he already had, with every answer standing. He submits; his response is
received and fixed, and answering or submitting again tells him it was already
handed in. Beginning again after that is refused for the same reason: one
hand-in per participant.

## Types

```types
external Subject
  An application-owned identity naming what is being responded to.

external Participant
  An application-owned identity for the one responding.

external Item
  An application-owned identity for the thing a single answer addresses.
```

## State

```state
a set of Responses with
  a subject     Subject
  a participant Participant
  a startedAt   Date
  an optional submittedAt Date

an InProgress set of Responses
a Submitted   set of Responses

a set of Answers with
  a response Response
  an item    Item
  a value    String

Rule: at most one response exists per subject and participant, so beginning again rejoins the response in progress.
Rule: an answer is keyed by its response and item: answering the same item again replaces the value in place.
Rule: a response's answers keep the order in which its items were first answered.
Rule: whether the subject is open to participation, whether an item belongs to the subject, and whether a response may be handed in are questions the surrounding design answers; Responding guards only what its own state answers, imposes no completeness rule, and owns nothing that happens after hand-in.
```

## Actions

```actions
begin (participant: Participant, subject: Subject, at: Date) : return (response: Response)
  where no response has subject and participant
  then
    add a new response with subject, participant, and startedAt at
    add response to inProgress
    return response
  where a response with subject and participant is in inProgress
  then
    return response
  where the response with subject and participant is in submitted
  then
    refuse ALREADY_SUBMITTED "This was already handed in."

answer (response: Response, item: Item, value: String) : return (response: Response)
  where response in inProgress
  then
    set the answer of response for item to value
    return response
  where response does not exist
  then
    refuse RESPONSE_NOT_FOUND "There is no such response."
  where response in submitted
  then
    refuse ALREADY_SUBMITTED "This was already handed in."

submit (response: Response, at: Date) : return (response: Response)
  where response in inProgress
  then
    remove response from inProgress
    add response to submitted
    set response's submittedAt to at
    return response
  where response does not exist
  then
    refuse RESPONSE_NOT_FOUND "There is no such response."
  where response in submitted
  then
    refuse ALREADY_SUBMITTED "This was already handed in."
```

## Queries

```queries
_response (response: String) : optional (subject: String, participant: String, submitted: Boolean, startedAt: Date, submittedAt: Date|Null)
  answers the complete Response
  answers no row when the Response does not exist

_responseFor (subject: String, participant: String) : optional (response: String, submitted: Boolean)
  answers the participant's one response to the subject
  answers no row when none exists

_responsesFor (subject: String) : many (response: String, participant: String, submitted: Boolean, startedAt: Date, submittedAt: Date|Null)
  answers the subject's responses, earliest begun first
  answers no rows when none match

_answers (response: String) : many (item: String, value: String)
  answers the response's answers in first-answer order
  answers no rows when none match

_valuesFor (subject: String, item: String) : many (response: String, participant: String, value: String)
  answers the item's answers from the subject's submitted responses, earliest
  hand-in first — nothing counts until it was handed in
  answers no rows when none match

_collectedAnswers (response: String) : optional (answers: Seq)
  answers the same answers as one value: an ordered sequence of `{ item, value }`
  pairs in first-answer order
  answers no row when the Response does not exist
```
