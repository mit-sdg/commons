# Commons vocabulary

Commons uses shared identity roles to connect otherwise independent concepts. These
edges are interpretations made by the application; no concept depends on another
concept's names.

```vocabulary
Authenticating.User = Profiling.User
Authenticating.User = Sessioning.User
Authenticating.User = Roling.User
Authenticating.User = Rostering.User
Assigning.Assignment = Submitting.Assignment
Assigning.Assignment = Grading.Assignment
Posting.Post = Conversing.Item
Posting.Post = Tagging.Target
Posting.Post = Reacting.Target
```

The executable vocabulary remains authoritative for registered concept signatures.
This document records the cross-concept meanings that composition relies on.

Application-owned pure computations render the email content selected by Commons
compositions:

```computations
invitationMailText(invitation: String, credential: String) : String
invitationMailHtml(invitation: String, credential: String) : String
notificationMailText(notification: String) : String
notificationMailHtml(notification: String) : String
```

These computations may know Commons copy, routes, and public origin. The generic
Mailing concept and SMTP adapter only retain and transport their rendered output.
