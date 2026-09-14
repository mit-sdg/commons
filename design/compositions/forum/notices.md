# Audience notices

Staff decide when a post is worth everyone's attention. A notice reaches the
people already allowed to read the discussion, so notifying widens no one's
access; it only raises what those readers already could have found.

[Whether staff may notify for a post](view:Forum.notices.noticeable) needs a
staff capability and the sender's own current read of that post. A staff account
that cannot read the post sees `NOT_FOUND`, the same answer the post gives every
other reader who is not admitted. Roots and replies are alike here: any readable
post may notify, including one published long before.

[Forum.notices.Preview](reaction:Forum.notices.Preview) answers
[how many people the notice would reach](former:Forum.notices.theNoticeAudienceOf)
together with whether that post has already notified, so the sender confirms a
number before sending rather than after. The audience is every current account
that may read the post, excluding its author; the author is excluded because the
notice carries their own words back to them. The count is a current reading, not
a reservation: a roster change between the preview and the send changes who is
notified, and the send answers with the count it actually used.

[Forum.notices.Notify](reaction:Forum.notices.Notify) captures the post's
content, its author, the sender, and the moment in NoticeSnapshotting before
choosing a single recipient. Capture is what makes the notice one-time:
Snapshotting admits one snapshot per subject, so a second press — or a second
click racing the first — is refused rather than notifying anyone twice. The
capture is also the record of what the audience received, so a later edit of the
post cannot rewrite it. A post that has already notified answers `CONFLICT`, and
[whether a post has notified](view:Forum.notices.noticed) is what the preview and
the send both consult.

A successful capture triggers
[Forum.notices.NoticeNotifiesAudience](reaction:Forum.notices.NoticeNotifiesAudience),
which notifies each admitted recipient with the kind `audience_notice`, the post
as subject and as link, and no actor: the post already says who wrote it, and the
event kind already says staff sent it. Each recipient is notified by an
independent action, and the capture is already stored: a fault for one recipient
leaves the notice sent to the others and does not make the post notifiable again.
Every such notification then follows the ordinary forum mail path, which already
carries the post's content, its author, and a direct discussion link; this kind
adds only its own event wording. Administrators in the audience receive both
the in-app notice and email under the same rules as other recipients; those
outside it receive neither.

[Forum.notices.ForConversation](reaction:Forum.notices.ForConversation) forms
[the notified posts of one discussion](former:Forum.notices.theNoticedPostsOf) so
a staff reader sees, for every post at once, whether its audience has already
been notified. It follows Conversing's thread order and reports only posts with a
capture. A reader who is not staff receives `FORBIDDEN`; a discussion that does
not admit the reader at all receives `NOT_FOUND`, so notice state discloses no
conversation a reader could not otherwise see.

Editing a notified post sends nothing further. A correction reaches the audience
only as a new post with its own notice.

Trash and permanent purge hide a post from every audience read, so a hidden post
offers no send and its notice state is no longer listed. The capture itself has
no removal: Snapshotting keeps what it captured, and a purged post's record
stays as the account of what its audience was once sent. Purge already clears
the notifications themselves.

```endpoints
Forum.notices.ForConversation at /notices/forConversation
Forum.notices.Notify at /notices/notify
Forum.notices.Preview at /notices/preview
```
