---
milestone: later
concepts:
  - Responding
  - Publishing
  - Relaying
---

# Arrive forms the whole face on every poll, and at 150 phones it is the room's cost

## Current behavior

Every phone polls `/live/p/arrive` on a three-second cadence while its run is
open, and each poll forms the relay face whole: the run's standing, every
round with its figure, and the open round's question, through fifteen indexed
reads. On a quiet room those reads take 190 ms at the median. At 150 phones
the room issues arrive at a rate the edge serves near its throughput, so
every other request waits behind it: the two seeded runs on the branch tip
(`evaluation/live-performance/runs/package-branch/` and
`package-branch-150/` in the design workspace) put arrive's median at 567 ms
and its p95 at 1,112 ms with 150 phones, three times the 45-phone median for
three times the phones, while the wall read's own cost stayed bounded and its
p95 rose only by queueing behind arrive. Nothing timed out, and the room
stayed a factor of about eight below the ten-second poll deadline.

Those are the numbers of a room in lockstep: the driver starts every phone
in one loop, so all 150 arrives land in the same instant every cadence, the
worst arrangement rather than a typical one. The same run with the phones
scattered across the cadence (after the poller's wake, which asks again
after a random delay of up to one cadence) put arrive's median at 24 to
37 ms and its p95 near 200 ms, and the spread held for the rest of the
class. A real room scatters by itself and synchronises again after a
room-wide event, such as a round opening or the class being told to unlock
their phones, which is what the scattered wake exists for. The cost of one
arrive is therefore modest; the cost of many at once is what the room pays
after every such event.

## Unresolved decision

Whether the face should be formed once per change and served to every phone
from that reading (a per-round change stamp the phone polls cheaply, or a
cached face invalidated by the run's moves), or whether arrive should read
less on a poll that finds nothing changed, and how either preserves the
per-phone parts of the face (the participant's own standing and the
sign-in requirement).

## Acceptance condition

At 150 phones on the reference laptop, arrive's median is within a small
factor of a single indexed read, the wall read's p95 no longer rises with the
number of phones polling arrive, and the phone still meets a round that opens
within one cadence.
