# Post reactions

A logged-in user adds one opaque reaction kind to a readable post through
[Forum.reactions.AddReaction](reaction:Forum.reactions.AddReaction). [Forum.reactions.RemoveReaction](reaction:Forum.reactions.RemoveReaction) removes only the caller's matching kind on
that post. Reacting refuses a duplicate user, post, and
kind tuple and a repeated removal; Commons does not restrict kinds to a fixed
set. Missing and trashed posts are hidden as `NOT_FOUND` before either change.

[Forum.reactions.ReactionsForTarget](reaction:Forum.reactions.ReactionsForTarget) forms
[each reactor and kind](former:Forum.reactions.theReactionsOn) on a readable post.
The separate [reaction-count former](former:Forum.reactions.theReactionCountsOn) groups that state by kind.
Neither read changes Reacting state.

Trash retains reactions and only hides the read, so restore reveals them again.
Permanent purge triggers [Forum.reactions.PurgeClearsReactions](reaction:Forum.reactions.PurgeClearsReactions) to remove every
reaction on the post. Ordinary Posting deletion requests the same idempotent
clear through post cleanup.
