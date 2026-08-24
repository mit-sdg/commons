/**
 * Was this role subject written as an email address?
 *
 * Holding an `@` is the whole test: Authenticating accepts only letters,
 * digits, hyphens, and underscores in a username, so a subject holding one
 * cannot be a username anybody could have registered, and a subject like
 * `a@b@c` is address-shaped too. Answering here is what lets the role
 * endpoints refuse an address no account holds while every other unmatched
 * reference stays an opaque user identity.
 */
export function subjectIsAddress({ subject }: { subject: string }): boolean {
  return typeof subject === "string" && subject.includes("@");
}
