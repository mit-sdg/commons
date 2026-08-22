export class InvitationAlreadyClaimed extends Error {
  readonly code = "INVITATION_ALREADY_CLAIMED";
}

export class InvitationInvalid extends Error {
  readonly code = "INVITATION_INVALID";
}

export class InvitationNotFound extends Error {
  readonly code = "INVITATION_NOT_FOUND";
}
