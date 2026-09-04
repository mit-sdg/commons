# Reasoning

## Purpose

Bring a mind to bear where only judgment will do: put a passage before a
reasoner and keep what it replies — with every ask standing visibly from the
moment it is made until it is answered or has honestly failed.

## Principle

Noor puts a half-finished argument before a reasoner. The ask stands pending —
anyone can see it is out — until the reasoner's answer arrives and the reply is
kept beside the passage: what was asked, of whom, and what came back. Asked the
same passage tomorrow, the reasoner may yield something different, and both
completions stand. When the reasoner cannot be reached at all, the ask is
marked failed with an account of why, so nothing waits forever on an answer
that is not coming — and answering an ask that was already answered is refused.

## Types

```types
external Reasoner
  An application-owned name for the mind asked; which endpoint, model, or provider it means is the floor's business.

external Subject
  An application-owned identity naming what the ask is about.
```

## State

```state
a set of Askings with
  a reasoner Reasoner
  an about   Subject
  a passage  String
  an askedAt Date

a Pending set of Askings

a set of Replies with
  an asking     Asking
  a reply       String
  an answeredAt Date

a set of Failures with
  an asking   Asking
  an account  String
  a failedAt  Date

Rule: an asking leaves pending exactly once, into a reply or a failure, and neither is ever forgotten.
Rule: every reply obtained is recorded, including one its reader will find unreadable — the record of what a mind was asked and what it gave back is the concept's whole point.
Rule: the reply is world-supplied — a worker on the floor reads the pending askings, puts each passage before the reasoner it names, and answers or fails the ask with what happened, the same shape as a mail outbox and its transport.
Rule: Reasoning does not own the mind it reaches, does not form passages, and does not interpret a reply; what the replied text means to the surrounding design is arranged outside the concept.
```

## Actions

```actions
ask (reasoner: Reasoner, about: Subject, passage: String, at: Date) : return (asking: Asking)
  where true
  then
    add a new asking with reasoner, about, passage, and askedAt at
    add asking to pending
    return asking

answer (asking: Asking, reply: String, at: Date) : return (asking: Asking, reply: String)
  where asking in pending
  then
    remove asking from pending
    add a new reply with asking, reply, and answeredAt at
    return asking, reply
  where asking does not exist
  then
    refuse ASKING_NOT_FOUND "There is no such ask."
  where asking not in pending
  then
    refuse ALREADY_SETTLED "This ask was already settled."

fail (asking: Asking, account: String, at: Date) : return (asking: Asking)
  where asking in pending
  then
    remove asking from pending
    add a new failure with asking, account, and failedAt at
    return asking
  where asking does not exist
  then
    refuse ASKING_NOT_FOUND "There is no such ask."
  where asking not in pending
  then
    refuse ALREADY_SETTLED "This ask was already settled."
```

## Queries

```queries
_pending () : many (asking: String, reasoner: String, about: String, passage: String, askedAt: Date)
  answers every pending asking, oldest first

_asking (asking: String) : optional (reasoner: String, about: String, passage: String, askedAt: Date, pending: Boolean)
  answers the complete Asking
  answers no row when the Asking does not exist

_replyOf (asking: String) : optional (reply: String, answeredAt: Date)
  answers the asking's reply
  answers no row when none was recorded

_failureOf (asking: String) : optional (account: String, failedAt: Date)
  answers the asking's failure
  answers no row when none was recorded

_repliesAbout (about: String) : many (asking: String, reasoner: String, passage: String, reply: String, answeredAt: Date)
  answers every answered asking about the subject, newest first
  answers no rows when none match

_lastFailureAbout (about: String) : optional (asking: String, account: String, failedAt: Date)
  answers the newest failure among the askings about the subject
  answers no row when none of them failed
```
