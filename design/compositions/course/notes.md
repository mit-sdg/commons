# Student notes

Staff with student-note capability create an open note through
[Course.notes.Write](reaction:Course.notes.Write). [Course.notes.Revise](reaction:Course.notes.Revise) updates an open note's body,
visibility, tags, and follow-up time. [Course.notes.Resolve](reaction:Course.notes.Resolve) moves an open note into its resolved state.
[Course.notes.Archive](reaction:Course.notes.Archive) hides a resolved note in its archived state.
[Course.notes.Restore](reaction:Course.notes.Restore) returns a resolved or archived note to open. Each action
uses current application time and leaves Noting's lifecycle refusals in force.

[Course.notes.NotesList](reaction:Course.notes.NotesList) gives authorized staff
[the learner's open and resolved notes](former:Course.notes.theStaffNotesOn), whether staff-only or disclosed.
The [theSeatDetailOf view](view:Course.notes.theSeatDetailOf) relates an account to its roster detail, which
[Course.notes.StudentsDetail](reaction:Course.notes.StudentsDetail) returns to the same staff; an absent seat is
`null`, while a caller without capability receives `FORBIDDEN`.

An active student sees only
[their own disclosed open and resolved notes](former:Course.notes.theNotesShownTo) through
[Course.notes.NotesVisible](reaction:Course.notes.NotesVisible). [Course.notes.Acknowledge](reaction:Course.notes.Acknowledge) records that learner's
acknowledgement only when Noting confirms both ownership and disclosure. An
archived note is absent from both lists until restored, although Noting retains
its acknowledgement and disclosure state.

Writing or disclosing a note, and reaching its follow-up time, sends no
notification or email. The follow-up timestamp is retained for readers rather
than used as a scheduler.
