# Access

Access composition establishes a caller from authentication and session state,
then applies shared authorization policy to forum and course operations. Request
identities never substitute for the user established by the active session.

## Compositions

### Authentication and sessions

Authenticating creates accounts and verifies credentials; Sessioning represents
logged-in use. Timing supplies the instant used to create, expire, and invalidate
sessions. Password changes invalidate the caller's sessions.

### Invitations

Registration consumes an email invitation before creating the account and
profile. Inviting owns the durable credential, while composition normalizes the
recipient, renders the Commons message, and gives Mailing a complete envelope.
Resending preserves the invitation credential.

### Roles and roster authority

Roling grants contextual capabilities. Rostering contributes course membership
and staff status; composition translates those facts into the capabilities used
by course and forum policy rather than copying them into either concept.

## Views

Access views derive the active user and paired allow/deny decisions from
Sessioning, Roling, Rostering, and the relevant resource state. The same views
are reused wherever a permission has the same application meaning.

## Declaration coverage

The following executable declarations implement the application decisions described in this document.

### Reaction declarations

- [`Access.auth.AcceptInvitation`](reaction:Access.auth.AcceptInvitation) supports the access composition described above.
- [`Access.auth.BootstrapAdminOnLogin`](reaction:Access.auth.BootstrapAdminOnLogin) supports the access composition described above.
- [`Access.auth.BootstrapAdminOnRegister`](reaction:Access.auth.BootstrapAdminOnRegister) supports the access composition described above.
- [`Access.auth.ChangePassword`](reaction:Access.auth.ChangePassword) supports the access composition described above.
- [`Access.auth.InvalidSessionIsRejected`](reaction:Access.auth.InvalidSessionIsRejected) supports the access composition described above.
- [`Access.auth.Login`](reaction:Access.auth.Login) supports the access composition described above.
- [`Access.auth.Logout`](reaction:Access.auth.Logout) supports the access composition described above.
- [`Access.auth.Me`](reaction:Access.auth.Me) supports the access composition described above.
- [`Access.auth.Resolve`](reaction:Access.auth.Resolve) supports the access composition described above.
- [`Access.invitations.EmailInvitationQueuesMail`](reaction:Access.invitations.EmailInvitationQueuesMail) supports the access composition described above.
- [`Access.invitations.Invite`](reaction:Access.invitations.Invite) supports the access composition described above.
- [`Access.invitations.List`](reaction:Access.invitations.List) supports the access composition described above.
- [`Access.roles.DefineRole`](reaction:Access.roles.DefineRole) supports the access composition described above.
- [`Access.roles.GrantRole`](reaction:Access.roles.GrantRole) supports the access composition described above.
- [`Access.roles.RevokeRole`](reaction:Access.roles.RevokeRole) supports the access composition described above.
- [`Access.roles.RoleCan`](reaction:Access.roles.RoleCan) supports the access composition described above.
- [`Access.roles.RoleGet`](reaction:Access.roles.RoleGet) supports the access composition described above.
- [`Access.roles.RoleList`](reaction:Access.roles.RoleList) supports the access composition described above.
- [`Access.roles.RolesForUser`](reaction:Access.roles.RolesForUser) supports the access composition described above.

### View declarations

- [`Access.auth.theUserNamed`](view:Access.auth.theUserNamed) supports the access composition described above.
- [`Access.policy.authored`](view:Access.policy.authored) supports the access composition described above.
- [`Access.policy.didNotAuthor`](view:Access.policy.didNotAuthor) supports the access composition described above.
- [`Access.policy.isActiveCourseMember`](view:Access.policy.isActiveCourseMember) supports the access composition described above.
- [`Access.policy.isActiveStudent`](view:Access.policy.isActiveStudent) supports the access composition described above.
- [`Access.policy.isNotActiveStudent`](view:Access.policy.isNotActiveStudent) supports the access composition described above.
- [`Access.policy.mayAdminister`](view:Access.policy.mayAdminister) supports the access composition described above.
- [`Access.policy.mayEditPost`](view:Access.policy.mayEditPost) supports the access composition described above.
- [`Access.policy.mayManageAssignments`](view:Access.policy.mayManageAssignments) supports the access composition described above.
- [`Access.policy.mayManageGrades`](view:Access.policy.mayManageGrades) supports the access composition described above.
- [`Access.policy.mayManageLateDays`](view:Access.policy.mayManageLateDays) supports the access composition described above.
- [`Access.policy.mayManageRoster`](view:Access.policy.mayManageRoster) supports the access composition described above.
- [`Access.policy.mayManageStudentNotes`](view:Access.policy.mayManageStudentNotes) supports the access composition described above.
- [`Access.policy.mayModerate`](view:Access.policy.mayModerate) supports the access composition described above.
- [`Access.policy.mayNotAdminister`](view:Access.policy.mayNotAdminister) supports the access composition described above.
- [`Access.policy.mayNotEditPost`](view:Access.policy.mayNotEditPost) supports the access composition described above.
- [`Access.policy.mayNotManageAssignments`](view:Access.policy.mayNotManageAssignments) supports the access composition described above.
- [`Access.policy.mayNotManageGrades`](view:Access.policy.mayNotManageGrades) supports the access composition described above.
- [`Access.policy.mayNotManageLateDays`](view:Access.policy.mayNotManageLateDays) supports the access composition described above.
- [`Access.policy.mayNotManageRoster`](view:Access.policy.mayNotManageRoster) supports the access composition described above.
- [`Access.policy.mayNotManageStudentNotes`](view:Access.policy.mayNotManageStudentNotes) supports the access composition described above.
- [`Access.policy.mayNotModerate`](view:Access.policy.mayNotModerate) supports the access composition described above.
- [`Access.policy.mayNotPinInScope`](view:Access.policy.mayNotPinInScope) supports the access composition described above.
- [`Access.policy.mayNotViewAllGrades`](view:Access.policy.mayNotViewAllGrades) supports the access composition described above.
- [`Access.policy.mayNotViewAllSubmissions`](view:Access.policy.mayNotViewAllSubmissions) supports the access composition described above.
- [`Access.policy.mayNotViewStaffCalendar`](view:Access.policy.mayNotViewStaffCalendar) supports the access composition described above.
- [`Access.policy.mayPinInScope`](view:Access.policy.mayPinInScope) supports the access composition described above.
- [`Access.policy.mayViewAllGrades`](view:Access.policy.mayViewAllGrades) supports the access composition described above.
- [`Access.policy.mayViewAllSubmissions`](view:Access.policy.mayViewAllSubmissions) supports the access composition described above.
- [`Access.policy.mayViewStaffCalendar`](view:Access.policy.mayViewStaffCalendar) supports the access composition described above.
- [`Access.session.activeUser`](view:Access.session.activeUser) supports the access composition described above.

### Former declarations

- [`Access.invitations.theInvitations`](former:Access.invitations.theInvitations) supports the access composition described above.
- [`Access.roles.theDefinedRoles`](former:Access.roles.theDefinedRoles) supports the access composition described above.
- [`Access.roles.theRolesHeldBy`](former:Access.roles.theRolesHeldBy) supports the access composition described above.
