---
milestone: later
concepts:
  - Responding
---

# A phone's answers and hand-in wait without a bound

## Current behavior

A phone's reads of the run and its automatic join each carry a ten-second deadline, after which the phone retries; a join whose reply was lost recovers its response, since beginning again returns the response already in progress. The phone's answer writes (`/live/p/answer`, `/live/p/answer-signed`) and hand-ins (`/live/p/submit`, `/live/p/submit-signed`) carry no client deadline. A write whose reply never arrives leaves the hand-in button busy for as long as the connection holds it, and the phone cannot tell a write the server took from one it never saw.

## Unresolved decision

How a phone bounds a write and recovers after the bound: whether it reads its response back before retrying (the server's answers and submitted state say whether the write landed), retries only writes that are safe to repeat, or both, while keeping the draft on the device.

## Acceptance condition

With the reply held before the server takes the write and again after it has, a phone recovers within a bound in both cases, keeps its draft, and never hands in twice; a browser test holds each reply.
