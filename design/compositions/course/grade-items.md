# Assignment grade items

When a draft accepts submissions,
[Course.gradeItems.DraftAcceptingAssignmentGetsGradeItem](reaction:Course.gradeItems.DraftAcceptingAssignmentGetsGradeItem)
ensures an assessment item so staff can select skills before publication.

When a newly published assignment accepts submissions,
[Course.gradeItems.PublishedAcceptingAssignmentGetsGradeItem](reaction:Course.gradeItems.PublishedAcceptingAssignmentGetsGradeItem) reads its current
title and ensures an assessment item with the assignment identity.

When a revision leaves an assignment accepting submissions,
[Course.gradeItems.RevisedAcceptingAssignmentEnsuresGradeItem](reaction:Course.gradeItems.RevisedAcceptingAssignmentEnsuresGradeItem) performs the
same ensure. An existing active grade item is left unchanged, including its
label and assessment structure; an archived item remains archived.

Assigning commits before each Itemizing request. A refusal or fault in that
request does not undo creation, publication, or revision.
