export class MailRecipientInvalid extends Error {
  readonly code = "MAIL_RECIPIENT_INVALID";
}

export class MailNotFound extends Error {
  readonly code = "MAIL_NOT_FOUND";
}
