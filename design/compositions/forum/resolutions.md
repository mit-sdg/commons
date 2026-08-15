# Accepted answers

Only the author of a readable question can accept a readable answer through
[Forum.resolutions.AcceptAnswer](reaction:Forum.resolutions.AcceptAnswer). A new acceptance replaces the prior answer;
question and answer need not share a conversation, and the answer need not be a
reply. The successful Resolving action independently triggers notification of
the answer author. [Forum.resolutions.ClearResolution](reaction:Forum.resolutions.ClearResolution) lets the same question
author remove the current acceptance; another caller receives `FORBIDDEN`,
while hidden posts return `NOT_FOUND`.

[Forum.resolutions.GetResolution](reaction:Forum.resolutions.GetResolution) forms
[the readable resolution](former:Forum.resolutions.theResolutionOf) of a readable question,
returning its accepted answer only while that answer is also readable.
[Forum.resolutions.IsResolved](reaction:Forum.resolutions.IsResolved) reports Resolving's status for a readable
question, so it can remain true while the accepted answer is trashed even though
the detailed public resolution is empty.

After permanent purge,
[Forum.resolutions.PurgedPostClearsResolutions](reaction:Forum.resolutions.PurgedPostClearsResolutions) clears the post's own question
resolution and every other question currently using that post as its answer. Each clear is independent; partial fan-out can remain if a later action
faults. Ordinary author deletion does not trigger this resolution cleanup.
