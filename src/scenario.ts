import { createLocalClient } from "@mit-sdg/sync-engine/client";
import type { CommonsWire } from "./client.ts";
import { createEdge } from "./edge.ts";

export async function runScenario() {
  const edge = createEdge();
  const commons = createLocalClient<CommonsWire>({ invoker: edge.gateway });
  const issued = await edge.application.concepts.Inviting.invite({
    channel: "email",
    address: "mara@example.test",
    at: new Date(),
  });

  const registered = await commons.auth["accept-invitation"]({
    invitation: issued.invitation,
    temporaryPassword: issued.credential,
    username: "mara",
    password: "long-enough-password",
    displayName: "Mara",
  });
  if ("error" in registered) throw new Error(String(registered.error));

  const login = await commons.auth.login({
    username: "mara",
    password: "long-enough-password",
  });
  if ("error" in login) throw new Error(String(login.error));

  const created = await commons.threads.create({
    session: login.session,
    content: "What should a course make possible?",
  });
  if ("error" in created) throw new Error(String(created.error));

  const listed = await commons.threads.activity({});
  if ("error" in listed) throw new Error(String(listed.error));

  return {
    registered: true,
    threadCreated: true,
    conversations: listed.conversations.length,
    firstPost: listed.conversations[0]?.post.content ?? null,
  };
}

if (import.meta.main) console.log(JSON.stringify(await runScenario(), null, 2));
