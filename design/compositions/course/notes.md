# Student notes

Staff holding `student-records` create an open note through
[Course.notes.Write](reaction:Course.notes.Write). [Course.notes.Revise](reaction:Course.notes.Revise) updates an open note's body,
visibility, tags, and follow-up time. [Course.notes.Resolve](reaction:Course.notes.Resolve) moves an open note into its resolved state.
[Course.notes.Archive](reaction:Course.notes.Archive) hides a resolved note in its archived state.
[Course.notes.Restore](reaction:Course.notes.Restore) returns a resolved or archived note to open. Each action
uses current application time and leaves Noting's lifecycle refusals in force.

[Course.notes.NotesList](reaction:Course.notes.NotesList) gives callers holding `student-records`
[the learner's open and resolved notes](former:Course.notes.theStaffNotesOn), whether staff-only or disclosed.
The [theSeatDetailOf view](view:Course.notes.theSeatDetailOf) relates an account to its roster detail, which
[Course.notes.StudentsDetail](reaction:Course.notes.StudentsDetail) returns to the same staff; an absent seat is
`null`, while a caller without `student-records` receives `FORBIDDEN`.

An active student sees only
[their own disclosed open and resolved notes](former:Course.notes.theNotesShownTo) through
[Course.notes.NotesVisible](reaction:Course.notes.NotesVisible). [Course.notes.Acknowledge](reaction:Course.notes.Acknowledge) records that learner's
acknowledgement only when Noting confirms both ownership and disclosure. An
archived note is absent from both lists until restored, although Noting retains
its acknowledgement and disclosure state.

Writing or disclosing a note, and reaching its follow-up time, sends no
notification or email. The follow-up timestamp is retained for readers rather
than used as a scheduler.

```endpoints
Course.notes.Acknowledge at /students/notes/acknowledge
Course.notes.Archive at /students/notes/archive
Course.notes.NotesList at /students/notes/list
Course.notes.NotesVisible at /students/notes/visible
Course.notes.Resolve at /students/notes/resolve
Course.notes.Restore at /students/notes/restore
Course.notes.Revise at /students/notes/revise
Course.notes.StudentsDetail at /students/detail
Course.notes.Write at /students/notes/write
```
