# Lectures

Course staff hold some runs as lectures and read who came. A run is held as a
lecture when it is pinned in the reserved Pinning scope `lectures`; a student
who joined at least one run of a lecture was there.

[Live.lectures.Mark](reaction:Live.lectures.Mark) pins a run in that scope for
a caller holding `live:host` or `course:manage`. Only a run that
[stands alone](view:Live.lectures.runStandsAlone) can be marked: a quiz, survey,
or relay run. A relay's round, or an identity that
[names no such run](view:Live.lectures.runDoesNotStandAlone), answers `NOT_FOUND`. A
closed run can be marked at any time, so lectures already held are marked
afterwards. Marking a marked run answers as the first mark did.
[Live.lectures.Unmark](reaction:Live.lectures.Unmark) removes the pin, and
unmarking an unmarked run changes nothing.

[Live.lectures.Runs](reaction:Live.lectures.Runs) lists every
[quiz and survey run](former:Live.lectures.theQuestionnaireRuns) and every
[relay run](former:Live.lectures.theRelayRuns), retired questionnaires and
relays included, each with when it opened and closed and whether it is held as
a lecture. [Live.lectures.Attendance](reaction:Live.lectures.Attendance) forms
[each run held as a lecture](former:Live.lectures.theLectureRuns) beside
[the active students](former:Live.lectures.theAttendanceRoster) and the class
time zone, read by [classTimezone](computation:classTimezone). Both reads are
open to anyone holding a staff capability or `live:host`, but the attendance
grid names every student, so it is refused to an active student. Each run is
named by
[its label](view:Live.lectures.theRunLabel): its questionnaire's or relay's
title, its kind, and when it opened.

A participant joins a quiz or survey by beginning a response to its run, and a
relay by beginning a response to one of its rounds, so a run's participants
are everyone with a response to the run or any of its rounds, submitted or
not. Responses are never deleted, so a closed run keeps who joined. Each run
carries the joiners who hold an active seat, and the joiners with no account
who are not one of the run's model seats: those joined without signing in.
The roster join happens here, so a grader who can't read the roster still
reads attendance. A lecture is the date a run opened in the class time zone,
and the grouping by date belongs to the browser's reading of these runs.

```computations
classTimezone(detail: Class) : String
  Reads the configured class's time zone, or null before a class is configured.

lectureSubjects(run: String, parts: Seq) : Seq
  Lists the subjects a run's participants respond to: the run and each of its rounds.

runTitle(quizTitle: String, relayTitle: String) : String
  Names a run by its questionnaire's title, else its relay's.

runKind(quizForm: String, relayTitle: String) : String
  Says whether a run is a quiz, a survey, or a relay.

signedOutJoiners(participants: Seq, accounts: Seq, seats: Seq) : Seq
  Lists the participants who are neither accounts nor the run's model seats.
```

```endpoints
Live.lectures.Attendance at /live/lectures/attendance
Live.lectures.Mark at /live/lectures/mark
Live.lectures.Runs at /live/lectures/runs
Live.lectures.Unmark at /live/lectures/unmark
```
