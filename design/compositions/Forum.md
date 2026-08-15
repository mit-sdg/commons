# Forum

Forum composition turns independently owned content, conversation, moderation,
organization, and personal-state mechanisms into a discussion space. Posting and
Conversing remain usable without depending on those surrounding behaviors.

## Compositions

### Threads and derived content

A new thread connects a Posting item to a Conversing node and conversation;
replies extend that structure. Formatting and Linking are refreshed from post
content, Revising records content history, and Tracking records unread items
without becoming part of Posting's lifecycle.

### Visibility and moderation

Readability combines Trashing, Locking, conversation placement, and Access
policy. Flagging, Locking, and Trashing retain separate state and authority.
Purging content coordinates cleanup of conversation placement, rendered content,
links, revisions, moderation records, and other dependent forum state; each
cleanup remains an independent concept action rather than a transaction.

### Organization and personal state

Categorizing and Tagging provide shared organization; Pinning adds moderated
prominence. Bookmarking, Reacting, Subscribing, and Tracking add user-specific
state without changing the content they refer to. Composition filters all of
these through the same readability decisions.

### Resolutions and notifications

Resolving associates an accepted answer with a question. Replies, mentions,
subscriptions, and accepted answers may create Notifying entries. Email delivery
is a further consequence: composition renders the notification and queues it in
Mailing, so forum actions do not depend on delivery success.

### Profiles

Profiling supplies forum presentation while Authenticating owns account names.
Composition exposes private profile details only to the owner or authorized
staff and uses public profile fragments in threads and user pages.

## Views

Forum views centralize content integrity, readability, placement, moderation,
profile visibility, and notification deduplication decisions.

## Formers

Forum formers assemble threads, feeds, profiles, moderation queues,
notifications, and satellite state from current concept queries. They do not
persist a second forum model.

## Declaration coverage

The following executable declarations implement the application decisions described in this document.

### Reaction declarations

- [`Forum.bookmarks.IsSaved`](reaction:Forum.bookmarks.IsSaved) supports the forum composition described above.
- [`Forum.bookmarks.ListBookmarks`](reaction:Forum.bookmarks.ListBookmarks) supports the forum composition described above.
- [`Forum.bookmarks.PurgeClearsBookmarks`](reaction:Forum.bookmarks.PurgeClearsBookmarks) supports the forum composition described above.
- [`Forum.bookmarks.SaveBookmark`](reaction:Forum.bookmarks.SaveBookmark) supports the forum composition described above.
- [`Forum.bookmarks.UnsaveBookmark`](reaction:Forum.bookmarks.UnsaveBookmark) supports the forum composition described above.
- [`Forum.categories.AssignCategory`](reaction:Forum.categories.AssignCategory) supports the forum composition described above.
- [`Forum.categories.CategoryForItem`](reaction:Forum.categories.CategoryForItem) supports the forum composition described above.
- [`Forum.categories.CategoryItems`](reaction:Forum.categories.CategoryItems) supports the forum composition described above.
- [`Forum.categories.CreateCategory`](reaction:Forum.categories.CreateCategory) supports the forum composition described above.
- [`Forum.categories.DeleteCategory`](reaction:Forum.categories.DeleteCategory) supports the forum composition described above.
- [`Forum.categories.ListCategories`](reaction:Forum.categories.ListCategories) supports the forum composition described above.
- [`Forum.categories.PurgeUnassignsCategory`](reaction:Forum.categories.PurgeUnassignsCategory) supports the forum composition described above.
- [`Forum.categories.UnassignCategory`](reaction:Forum.categories.UnassignCategory) supports the forum composition described above.
- [`Forum.links.Backlinks`](reaction:Forum.links.Backlinks) supports the forum composition described above.
- [`Forum.links.Forward`](reaction:Forum.links.Forward) supports the forum composition described above.
- [`Forum.moderation.FlagRaise`](reaction:Forum.moderation.FlagRaise) supports the forum composition described above.
- [`Forum.moderation.FlagResolve`](reaction:Forum.moderation.FlagResolve) supports the forum composition described above.
- [`Forum.moderation.FlagsForTarget`](reaction:Forum.moderation.FlagsForTarget) supports the forum composition described above.
- [`Forum.moderation.FlagsOpen`](reaction:Forum.moderation.FlagsOpen) supports the forum composition described above.
- [`Forum.moderation.GetTrashedPost`](reaction:Forum.moderation.GetTrashedPost) supports the forum composition described above.
- [`Forum.moderation.IsLocked`](reaction:Forum.moderation.IsLocked) supports the forum composition described above.
- [`Forum.moderation.IsTrashed`](reaction:Forum.moderation.IsTrashed) supports the forum composition described above.
- [`Forum.moderation.LockList`](reaction:Forum.moderation.LockList) supports the forum composition described above.
- [`Forum.moderation.LockTarget`](reaction:Forum.moderation.LockTarget) supports the forum composition described above.
- [`Forum.moderation.PurgedItemClearsModerationState`](reaction:Forum.moderation.PurgedItemClearsModerationState) supports the forum composition described above.
- [`Forum.moderation.PurgeItem`](reaction:Forum.moderation.PurgeItem) supports the forum composition described above.
- [`Forum.moderation.RestoreItem`](reaction:Forum.moderation.RestoreItem) supports the forum composition described above.
- [`Forum.moderation.TrashItem`](reaction:Forum.moderation.TrashItem) supports the forum composition described above.
- [`Forum.moderation.TrashList`](reaction:Forum.moderation.TrashList) supports the forum composition described above.
- [`Forum.moderation.UnlockTarget`](reaction:Forum.moderation.UnlockTarget) supports the forum composition described above.
- [`Forum.notifications.AcceptNotifiesAnswerAuthor`](reaction:Forum.notifications.AcceptNotifiesAnswerAuthor) supports the forum composition described above.
- [`Forum.notifications.Dismiss`](reaction:Forum.notifications.Dismiss) supports the forum composition described above.
- [`Forum.notifications.EditMentionsNotify`](reaction:Forum.notifications.EditMentionsNotify) supports the forum composition described above.
- [`Forum.notifications.ListNotifications`](reaction:Forum.notifications.ListNotifications) supports the forum composition described above.
- [`Forum.notifications.MarkAllRead`](reaction:Forum.notifications.MarkAllRead) supports the forum composition described above.
- [`Forum.notifications.MarkRead`](reaction:Forum.notifications.MarkRead) supports the forum composition described above.
- [`Forum.notifications.NotificationQueuesEmail`](reaction:Forum.notifications.NotificationQueuesEmail) supports the forum composition described above.
- [`Forum.notifications.PurgeClearsNotifications`](reaction:Forum.notifications.PurgeClearsNotifications) supports the forum composition described above.
- [`Forum.notifications.ReadInbox`](reaction:Forum.notifications.ReadInbox) supports the forum composition described above.
- [`Forum.notifications.ReplyMentionsNotify`](reaction:Forum.notifications.ReplyMentionsNotify) supports the forum composition described above.
- [`Forum.notifications.ReplyNotifiesParentAuthor`](reaction:Forum.notifications.ReplyNotifiesParentAuthor) supports the forum composition described above.
- [`Forum.notifications.ReplyNotifiesWatchers`](reaction:Forum.notifications.ReplyNotifiesWatchers) supports the forum composition described above.
- [`Forum.notifications.RootMentionsNotify`](reaction:Forum.notifications.RootMentionsNotify) supports the forum composition described above.
- [`Forum.notifications.UnreadCount`](reaction:Forum.notifications.UnreadCount) supports the forum composition described above.
- [`Forum.pins.IsPinned`](reaction:Forum.pins.IsPinned) supports the forum composition described above.
- [`Forum.pins.PinItem`](reaction:Forum.pins.PinItem) supports the forum composition described above.
- [`Forum.pins.PinsForScope`](reaction:Forum.pins.PinsForScope) supports the forum composition described above.
- [`Forum.pins.PurgeClearsPins`](reaction:Forum.pins.PurgeClearsPins) supports the forum composition described above.
- [`Forum.pins.SetPinPriority`](reaction:Forum.pins.SetPinPriority) supports the forum composition described above.
- [`Forum.pins.UnpinItem`](reaction:Forum.pins.UnpinItem) supports the forum composition described above.
- [`Forum.posts.DeletedPostClearsSatellites`](reaction:Forum.posts.DeletedPostClearsSatellites) supports the forum composition described above.
- [`Forum.posts.DeletePost`](reaction:Forum.posts.DeletePost) supports the forum composition described above.
- [`Forum.posts.EditedPostRefreshesDerivedContent`](reaction:Forum.posts.EditedPostRefreshesDerivedContent) supports the forum composition described above.
- [`Forum.posts.EditPost`](reaction:Forum.posts.EditPost) supports the forum composition described above.
- [`Forum.posts.GetPost`](reaction:Forum.posts.GetPost) supports the forum composition described above.
- [`Forum.posts.PostsByAuthor`](reaction:Forum.posts.PostsByAuthor) supports the forum composition described above.
- [`Forum.profiles.GetProfile`](reaction:Forum.profiles.GetProfile) supports the forum composition described above.
- [`Forum.profiles.ResolvePublicUser`](reaction:Forum.profiles.ResolvePublicUser) supports the forum composition described above.
- [`Forum.profiles.SearchUsers`](reaction:Forum.profiles.SearchUsers) supports the forum composition described above.
- [`Forum.profiles.SetAvatar`](reaction:Forum.profiles.SetAvatar) supports the forum composition described above.
- [`Forum.profiles.SetBio`](reaction:Forum.profiles.SetBio) supports the forum composition described above.
- [`Forum.profiles.SetDisplayName`](reaction:Forum.profiles.SetDisplayName) supports the forum composition described above.
- [`Forum.reactions.AddReaction`](reaction:Forum.reactions.AddReaction) supports the forum composition described above.
- [`Forum.reactions.PurgeClearsReactions`](reaction:Forum.reactions.PurgeClearsReactions) supports the forum composition described above.
- [`Forum.reactions.ReactionsForTarget`](reaction:Forum.reactions.ReactionsForTarget) supports the forum composition described above.
- [`Forum.reactions.RemoveReaction`](reaction:Forum.reactions.RemoveReaction) supports the forum composition described above.
- [`Forum.resolutions.AcceptAnswer`](reaction:Forum.resolutions.AcceptAnswer) supports the forum composition described above.
- [`Forum.resolutions.ClearResolution`](reaction:Forum.resolutions.ClearResolution) supports the forum composition described above.
- [`Forum.resolutions.GetResolution`](reaction:Forum.resolutions.GetResolution) supports the forum composition described above.
- [`Forum.resolutions.IsResolved`](reaction:Forum.resolutions.IsResolved) supports the forum composition described above.
- [`Forum.resolutions.PurgedPostClearsResolutions`](reaction:Forum.resolutions.PurgedPostClearsResolutions) supports the forum composition described above.
- [`Forum.revisions.GetRevision`](reaction:Forum.revisions.GetRevision) supports the forum composition described above.
- [`Forum.revisions.LatestRevision`](reaction:Forum.revisions.LatestRevision) supports the forum composition described above.
- [`Forum.revisions.ListRevisions`](reaction:Forum.revisions.ListRevisions) supports the forum composition described above.
- [`Forum.revisions.ModeratorGetRevision`](reaction:Forum.revisions.ModeratorGetRevision) supports the forum composition described above.
- [`Forum.revisions.ModeratorLatestRevision`](reaction:Forum.revisions.ModeratorLatestRevision) supports the forum composition described above.
- [`Forum.revisions.ModeratorListRevisions`](reaction:Forum.revisions.ModeratorListRevisions) supports the forum composition described above.
- [`Forum.revisions.PurgeClearsRevisions`](reaction:Forum.revisions.PurgeClearsRevisions) supports the forum composition described above.
- [`Forum.revisions.RecordRevisionOnCreate`](reaction:Forum.revisions.RecordRevisionOnCreate) supports the forum composition described above.
- [`Forum.revisions.RecordRevisionOnEdit`](reaction:Forum.revisions.RecordRevisionOnEdit) supports the forum composition described above.
- [`Forum.subscriptions.IsSubscribed`](reaction:Forum.subscriptions.IsSubscribed) supports the forum composition described above.
- [`Forum.subscriptions.MySubscriptions`](reaction:Forum.subscriptions.MySubscriptions) supports the forum composition described above.
- [`Forum.subscriptions.PurgeClearsConversationSubscriptions`](reaction:Forum.subscriptions.PurgeClearsConversationSubscriptions) supports the forum composition described above.
- [`Forum.subscriptions.Subscribe`](reaction:Forum.subscriptions.Subscribe) supports the forum composition described above.
- [`Forum.subscriptions.Subscribers`](reaction:Forum.subscriptions.Subscribers) supports the forum composition described above.
- [`Forum.subscriptions.Unsubscribe`](reaction:Forum.subscriptions.Unsubscribe) supports the forum composition described above.
- [`Forum.tags.AddTag`](reaction:Forum.tags.AddTag) supports the forum composition described above.
- [`Forum.tags.CreateTag`](reaction:Forum.tags.CreateTag) supports the forum composition described above.
- [`Forum.tags.ListTags`](reaction:Forum.tags.ListTags) supports the forum composition described above.
- [`Forum.tags.PurgeClearsTags`](reaction:Forum.tags.PurgeClearsTags) supports the forum composition described above.
- [`Forum.tags.RemoveTag`](reaction:Forum.tags.RemoveTag) supports the forum composition described above.
- [`Forum.tags.TagsForTarget`](reaction:Forum.tags.TagsForTarget) supports the forum composition described above.
- [`Forum.tags.TagTargets`](reaction:Forum.tags.TagTargets) supports the forum composition described above.
- [`Forum.tags.TagTargetsByName`](reaction:Forum.tags.TagTargetsByName) supports the forum composition described above.
- [`Forum.threads.CreatedPostRefreshesDerivedContent`](reaction:Forum.threads.CreatedPostRefreshesDerivedContent) supports the forum composition described above.
- [`Forum.threads.CreateThread`](reaction:Forum.threads.CreateThread) supports the forum composition described above.
- [`Forum.threads.ForItem`](reaction:Forum.threads.ForItem) supports the forum composition described above.
- [`Forum.threads.GetThread`](reaction:Forum.threads.GetThread) supports the forum composition described above.
- [`Forum.threads.ListActivity`](reaction:Forum.threads.ListActivity) supports the forum composition described above.
- [`Forum.threads.ListLatest`](reaction:Forum.threads.ListLatest) supports the forum composition described above.
- [`Forum.threads.ReplyToThread`](reaction:Forum.threads.ReplyToThread) supports the forum composition described above.
- [`Forum.threads.TrackReplyUnread`](reaction:Forum.threads.TrackReplyUnread) supports the forum composition described above.
- [`Forum.threads.TrackRootUnread`](reaction:Forum.threads.TrackRootUnread) supports the forum composition described above.
- [`Forum.unread.MarkAllSeen`](reaction:Forum.unread.MarkAllSeen) supports the forum composition described above.
- [`Forum.unread.MarkSeen`](reaction:Forum.unread.MarkSeen) supports the forum composition described above.
- [`Forum.unread.UnreadCount`](reaction:Forum.unread.UnreadCount) supports the forum composition described above.
- [`Forum.unread.UnreadList`](reaction:Forum.unread.UnreadList) supports the forum composition described above.

### View declarations

- [`Forum.bookmarks.readableBookmarksOf`](view:Forum.bookmarks.readableBookmarksOf) supports the forum composition described above.
- [`Forum.fragments.publicThreadPosts`](view:Forum.fragments.publicThreadPosts) supports the forum composition described above.
- [`Forum.notifications.isNotMentionedIn`](view:Forum.notifications.isNotMentionedIn) supports the forum composition described above.
- [`Forum.notifications.isNotYetNotifiedAbout`](view:Forum.notifications.isNotYetNotifiedAbout) supports the forum composition described above.
- [`Forum.notifications.otherUsersMentionedIn`](view:Forum.notifications.otherUsersMentionedIn) supports the forum composition described above.
- [`Forum.posts.notReadable`](view:Forum.posts.notReadable) supports the forum composition described above.
- [`Forum.posts.publicPostsBy`](view:Forum.posts.publicPostsBy) supports the forum composition described above.
- [`Forum.posts.readable`](view:Forum.posts.readable) supports the forum composition described above.
- [`Forum.profiles.theProfileOf`](view:Forum.profiles.theProfileOf) supports the forum composition described above.
- [`Forum.threads.intact`](view:Forum.threads.intact) supports the forum composition described above.
- [`Forum.threads.placementOf`](view:Forum.threads.placementOf) supports the forum composition described above.
- [`Forum.threads.publicTarget`](view:Forum.threads.publicTarget) supports the forum composition described above.
- [`Forum.threads.readableConversation`](view:Forum.threads.readableConversation) supports the forum composition described above.

### Former declarations

- [`Forum.bookmarks.theBookmarkedPostsOf`](former:Forum.bookmarks.theBookmarkedPostsOf) supports the forum composition described above.
- [`Forum.bookmarks.theBookmarksOf`](former:Forum.bookmarks.theBookmarksOf) supports the forum composition described above.
- [`Forum.categories.theCategories`](former:Forum.categories.theCategories) supports the forum composition described above.
- [`Forum.categories.theCategoryOf`](former:Forum.categories.theCategoryOf) supports the forum composition described above.
- [`Forum.categories.theItemsIn`](former:Forum.categories.theItemsIn) supports the forum composition described above.
- [`Forum.fragments.thePostSummaryOf`](former:Forum.fragments.thePostSummaryOf) supports the forum composition described above.
- [`Forum.fragments.thePrivateProfileOf`](former:Forum.fragments.thePrivateProfileOf) supports the forum composition described above.
- [`Forum.fragments.theProfileFaceOf`](former:Forum.fragments.theProfileFaceOf) supports the forum composition described above.
- [`Forum.fragments.theThreadStatsOf`](former:Forum.fragments.theThreadStatsOf) supports the forum composition described above.
- [`Forum.links.theBacklinksOf`](former:Forum.links.theBacklinksOf) supports the forum composition described above.
- [`Forum.links.theForwardLinksOf`](former:Forum.links.theForwardLinksOf) supports the forum composition described above.
- [`Forum.moderation.theFlagsOn`](former:Forum.moderation.theFlagsOn) supports the forum composition described above.
- [`Forum.moderation.theLockedList`](former:Forum.moderation.theLockedList) supports the forum composition described above.
- [`Forum.moderation.theModerationQueue`](former:Forum.moderation.theModerationQueue) supports the forum composition described above.
- [`Forum.moderation.theOpenFlags`](former:Forum.moderation.theOpenFlags) supports the forum composition described above.
- [`Forum.moderation.theTrashBin`](former:Forum.moderation.theTrashBin) supports the forum composition described above.
- [`Forum.notifications.theInboxOf`](former:Forum.notifications.theInboxOf) supports the forum composition described above.
- [`Forum.notifications.theNotificationPresentationOf`](former:Forum.notifications.theNotificationPresentationOf) supports the forum composition described above.
- [`Forum.notifications.theNotificationsOf`](former:Forum.notifications.theNotificationsOf) supports the forum composition described above.
- [`Forum.pins.thePinsOf`](former:Forum.pins.thePinsOf) supports the forum composition described above.
- [`Forum.posts.thePost`](former:Forum.posts.thePost) supports the forum composition described above.
- [`Forum.posts.thePublicPostsOf`](former:Forum.posts.thePublicPostsOf) supports the forum composition described above.
- [`Forum.profiles.theUserPage`](former:Forum.profiles.theUserPage) supports the forum composition described above.
- [`Forum.profiles.theUserSearch`](former:Forum.profiles.theUserSearch) supports the forum composition described above.
- [`Forum.reactions.theReactionCountsOn`](former:Forum.reactions.theReactionCountsOn) supports the forum composition described above.
- [`Forum.reactions.theReactionsOn`](former:Forum.reactions.theReactionsOn) supports the forum composition described above.
- [`Forum.resolutions.theResolutionOf`](former:Forum.resolutions.theResolutionOf) supports the forum composition described above.
- [`Forum.revisions.theLatestRevisionOf`](former:Forum.revisions.theLatestRevisionOf) supports the forum composition described above.
- [`Forum.revisions.theRevisionHistoryOf`](former:Forum.revisions.theRevisionHistoryOf) supports the forum composition described above.
- [`Forum.revisions.theRevisionNumberedOf`](former:Forum.revisions.theRevisionNumberedOf) supports the forum composition described above.
- [`Forum.subscriptions.theSubscribersOf`](former:Forum.subscriptions.theSubscribersOf) supports the forum composition described above.
- [`Forum.subscriptions.theSubscriptionsOf`](former:Forum.subscriptions.theSubscriptionsOf) supports the forum composition described above.
- [`Forum.subscriptions.theWatchedThreadsOf`](former:Forum.subscriptions.theWatchedThreadsOf) supports the forum composition described above.
- [`Forum.tags.theTags`](former:Forum.tags.theTags) supports the forum composition described above.
- [`Forum.tags.theTagsOn`](former:Forum.tags.theTagsOn) supports the forum composition described above.
- [`Forum.tags.theTargetsTagged`](former:Forum.tags.theTargetsTagged) supports the forum composition described above.
- [`Forum.tags.theTargetsTaggedWithName`](former:Forum.tags.theTargetsTaggedWithName) supports the forum composition described above.
- [`Forum.threads.theHomeFeedByActivity`](former:Forum.threads.theHomeFeedByActivity) supports the forum composition described above.
- [`Forum.threads.theHomeFeedByCreation`](former:Forum.threads.theHomeFeedByCreation) supports the forum composition described above.
- [`Forum.threads.theThread`](former:Forum.threads.theThread) supports the forum composition described above.
- [`Forum.threads.theThreadContext`](former:Forum.threads.theThreadContext) supports the forum composition described above.
- [`Forum.unread.theUnreadOf`](former:Forum.unread.theUnreadOf) supports the forum composition described above.
