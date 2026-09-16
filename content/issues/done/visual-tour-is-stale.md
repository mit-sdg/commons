---
milestone: later
concepts:
  - Relaying
---

# The visual tour no longer reaches the live screens

## Resolution at completion

The tour walks the whole relay again. Four steps in `tests/visual/tour.spec.ts`
now name what the screens say.

The relay editor's reference documents moved behind a button. The tour looked
for a heading reading "Reference documents" and an "Add reference" button
beside it. The editor now carries a "References" button next to "Edit with AI",
and the panel that button opens is headed "Documents" with "Add document"
beside the heading, so the step opens the panel first.

Launch on the relay overview opens a dialog that asks who can participate, and
the run starts from the dialog's own Launch. The tour pressed Launch once and
waited for the run's address. It now presses Launch in the dialog as well, the
way the step that closes a run already presses Close run twice.

The Seats box on the run dashboard sits inside a disclosure whose summary reads
"AI participants", closed when the page loads. The tour typed into Seats as
soon as the wall settled. It now opens the disclosure first.

A vote choice on the phone shares its words with the control that inspects that
choice's responses, so the button named after the first choice matched two
buttons. The step names the choice exactly.

## Decision at completion

Only the failing steps changed. The relay the tour writes, the order of the
walk, the widths, the waits, and the names of the screenshots are all as they
were. These screenshots are read beside the design mockups, and a shot is
worth reading beside an earlier one only when it was taken of the same screen
at the same point in the same walk.

## Verification at completion

`bun run tour` completes both themes and writes every screenshot the tour
names under `test-results/tour-shots/`.
