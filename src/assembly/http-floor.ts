import { httpFloor } from "@mit-sdg/sync-engine/boundary";

export function commonsHttpFloor(origin: string) {
  return httpFloor({
    origin,
    credential: {
      name: "session",
      input: "session",
      issue: { path: "/auth/login", output: "session", expires: "expiresAt" },
      clear: ["/auth/logout", "/auth/changePassword"],
    },
  });
}
