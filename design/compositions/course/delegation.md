# Grading delegation

Grading delegation belongs to an assignment and learner, not to one submission
attempt. A later submission therefore keeps the same grader, and changing a
grader never edits an assessment already underway. These routes organize work;
they do not narrow the existing `grade` permission.

[Course.delegation.DelegationGraders](reaction:Course.delegation.DelegationGraders)
answers [the active accounts that may grade](former:Course.delegation.theGraders):
holders of `grade` or the `administer` wildcard in Commons, whether or not they
have a roster seat. Archived accounts are omitted.

[Course.delegation.DelegationForItem](reaction:Course.delegation.DelegationForItem)
answers [the stored owner beside each learner](former:Course.delegation.theDelegationsOn).
A former grader is still shown after losing access so staff can see and replace
the stale ownership, but is absent from the choices.

[Course.delegation.DelegationSet](reaction:Course.delegation.DelegationSet) and
[Course.delegation.DelegationClear](reaction:Course.delegation.DelegationClear)
assign, reassign, and unassign one learner. The caller must hold `grade`; the
assignment and its learner release must exist; and a named grader must be a
registered, unarchived account [currently available to grade](view:Course.delegation.availableGrader).
Invalid identities answer `NOT_FOUND`.

[Course.delegation.DelegationSpread](reaction:Course.delegation.DelegationSpread)
validates [the entire distinct grader selection](view:Course.delegation.everyGraderIsAvailable)
and [learner selection](view:Course.delegation.everyLearnerIsAssigned) against current state before
it makes any change. [allChosenAdmitted](computation:allChosenAdmitted) answers true exactly when
one requested selection is non-empty and distinct and every requested identity appears in the
current-state answer. [validDelegationSpreadInput](computation:validDelegationSpreadInput) answers
whether the untrusted item is a non-empty string, learners and graders are non-empty distinct
string arrays, and `replace` is strictly boolean; malformed inputs are refused before any state
query receives them. Delegating
then applies the distribution as
one atomic item update. With `replace` false it rechecks ownership inside that
atomic decision and skips anyone assigned since the dialog opened; with
`replace` true it deliberately redistributes all named learners. Existing loads
among the selected graders are counted so adding remaining learners moves the
assignment toward an even split.

[Course.delegation.DelegationClearItem](reaction:Course.delegation.DelegationClearItem)
removes all ownership on one real assignment without touching submissions or
assessments.

Every item, learner, and grader identity on the single-item routes first passes
[validDelegationIdentityInput](computation:validDelegationIdentityInput), so malformed selector
objects are refused as `INVALID_REQUEST` before a Mongo query receives them.

```endpoints
Course.delegation.DelegationClear at /delegation/clear
Course.delegation.DelegationClearItem at /delegation/clear-item
Course.delegation.DelegationForItem at /delegation/for-item
Course.delegation.DelegationGraders at /delegation/graders
Course.delegation.DelegationSet at /delegation/set
Course.delegation.DelegationSpread at /delegation/spread
```
