/** Personal scope identities are the account identity itself. */
export function ownsTaskScope({ user, scope }: { user: string; scope: string }): boolean {
  return user === scope;
}
