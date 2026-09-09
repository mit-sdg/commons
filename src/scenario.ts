import type { CommonsImplementations } from "./assembly/application.ts";
import { constructConceptFloor } from "./assembly/concept-floor.ts";
import { createLocalClient } from "@mit-sdg/sync-engine/client";
import type { CommonsWire } from "./client.ts";
import { createEdge } from "./edge.ts";

export async function runScenario(instances: CommonsImplementations) {
  const edge = createEdge(instances);
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

  await edge.application.concepts.Rostering.enrol({
    user: registered.user,
    email: "mara@example.test",
    kind: "STUDENT",
    section: null,
  });
  const created = await commons.threads.create({
    session: login.session,
    content: "What should a course make possible?",
    holders: ["standing:everyone"],
  });
  if ("error" in created) throw new Error(String(created.error));

  const listed = await commons.threads.activity({ session: login.session });
  if ("error" in listed) throw new Error(String(listed.error));

  return {
    registered: true,
    threadCreated: true,
    conversations: listed.conversations.length,
    firstPost: listed.conversations[0]?.post.content ?? null,
  };
}

if (import.meta.main) {
  const floor = await constructConceptFloor(process.env.MONGODB_URL);
  try {
    console.log(JSON.stringify(await runScenario(floor.instances), null, 2));
  } finally {
    await floor.close();
  }
}
