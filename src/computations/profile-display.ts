export function validProfileSelection({ users }: { users: string[] }): boolean {
  return (
    Array.isArray(users) &&
    users.length <= 64 &&
    users.every((user) => typeof user === "string" && user.length > 0 && user.length <= 256)
  );
}
