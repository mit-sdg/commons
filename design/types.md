# Commons application types

Commons connects independent concept parameters to shared application identities.
These bindings describe application meaning; concept implementations remain independent.

```types
concrete StringList
  An ordered collection of strings used at the Commons boundary.

concrete SectionList
  A collection of course section identifiers.

concrete RosterRows
  A collection of roster import records supplied by an administrator.

concrete Context
  A stable application scope such as the course or forum.

concrete GradeEvidence
  An optional reference to evidence supporting a grade.

Assigning.Author is Authenticating.User
  Assignment authors are Commons users.

Assigning.Assignee is Authenticating.User
  Assignment recipients are Commons users.

Assigning.Sections is SectionList
  Assignment audiences use course section identifiers.

Banking.Learner is Authenticating.User
  Late-day balances belong to Commons users.

Banking.Item is Assigning.Assignment
  Late days are applied to assignments.

Bookmarking.User is Authenticating.User
  Bookmarks belong to Commons users.

Bookmarking.Item is Posting.Post
  Commons bookmarks forum posts.

Categorizing.Item is Posting.Post
  Forum categories organize posts.

Conversing.Item is Posting.Post
  Conversation nodes contain posts.

Flagging.User is Authenticating.User
  Flag reporters are Commons users.

Flagging.Target is Posting.Post
  Commons moderation flags target posts.

Formatting.Target is Posting.Post
  Rendered forum content belongs to posts.

Grading.Learner is Authenticating.User
  Grades belong to Commons users acting as learners.

Grading.Item is Assigning.Assignment
  Gradebook items correspond to assignments.

Grading.Evidence is GradeEvidence
  Grade evidence is an optional application reference.

Grading.Grader is Authenticating.User
  Graders are Commons users.

Grading.Criterion is Itemizing.Criterion
  Criterion scores use criteria owned by Itemizing.

Itemizing.Item is Assigning.Assignment
  Grade items correspond to assignments.

Linking.Source is Posting.Post
  Forum links originate from posts.

Linking.Target is Posting.Post
  Backlinks resolve to posts.

Linking.Targets is StringList
  Extracted link targets are represented as strings.

Locking.Target is Posting.Post
  Commons locks forum posts.

Notifying.Person is Authenticating.User
  Notification recipients are Commons users.

Notifying.Target is Posting.Post
  Forum notifications refer to posts.

Noting.Author is Authenticating.User
  Note authors are Commons users acting as staff.

Noting.Learner is Authenticating.User
  Notes concern Commons users acting as learners.

Noting.Strings is StringList
  Note tags are represented as strings.

Pinning.Item is Posting.Post
  Commons pins forum posts.

Pinning.Scope is Context
  Pins are grouped by an application context.

Posting.Author is Authenticating.User
  Post authors are Commons users.

Profiling.User is Authenticating.User
  Profiles belong to Commons users.

Reacting.Person is Authenticating.User
  Reactions belong to Commons users.

Reacting.Target is Posting.Post
  Commons reactions target posts.

Resolving.Question is Posting.Post
  Questions are forum posts.

Resolving.Answer is Posting.Post
  Accepted answers are forum posts.

Resolving.User is Authenticating.User
  Resolutions are selected by Commons users.

Revising.Item is Posting.Post
  Revision histories belong to posts.

Roling.User is Authenticating.User
  Roles are granted to Commons users.

Roling.Context is Context
  Role grants apply within an application context.

Roling.Strings is StringList
  Role capability sets are represented as strings.

Rostering.Class is Context
  The roster represents the Commons course context.

Rostering.User is Authenticating.User
  Claimed roster seats belong to Commons users.

Rostering.Strings is StringList
  Seat role sets are represented as strings.

Rostering.Rows is RosterRows
  Administrators import roster rows as one application value.

Sessioning.User is Authenticating.User
  Sessions identify Commons users.

Sessioning.Moment is Timing.Moment
  Session expiry is measured by the application clock.

Submitting.Assignment is Assigning.Assignment
  Submissions belong to assignments.

Submitting.Submitter is Authenticating.User
  Submitters are Commons users.

Submitting.Strings is StringList
  Submission artifact collections are represented as strings.

Subscribing.Person is Authenticating.User
  Subscriptions belong to Commons users.

Subscribing.Target is Posting.Post
  Commons subscriptions watch posts.

Tagging.Target is Posting.Post
  Commons tags annotate posts.

Tracking.User is Authenticating.User
  Read tracking belongs to Commons users.

Tracking.Scope is Context
  Read state is partitioned by application context.

Tracking.Item is Posting.Post
  Commons tracks read state for posts.

Trashing.User is Authenticating.User
  Trash records retain the acting Commons user.

Trashing.Item is Posting.Post
  Commons trash lifecycle applies to posts.
```

Commons also registers pure computations used to render application-owned email
content:

```computations
invitationMailText(invitation: String, credential: String) : String
  Produces the plain-text invitation containing its credential and sign-in route.

invitationMailHtml(invitation: String, credential: String) : String
  Produces the HTML invitation containing its credential and sign-in route.

notificationMailText(notification: String) : String
  Produces plain-text notification email content.

notificationMailHtml(notification: String) : String
  Produces HTML notification email content.
```
