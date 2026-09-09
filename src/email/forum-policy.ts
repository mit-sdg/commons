import { theMailEligibility } from "../compositions/forum/notifications.ts";
import type { CommonsApp } from "../assembly/application.ts";
import type { MailEligibility } from "./worker.ts";

export function forumMailEligibility(application: Pick<CommonsApp, "form">): MailEligibility {
  return async (mail) => {
    if (!mail.key.startsWith("forum:")) return true;
    let context: unknown;
    try {
      context = JSON.parse(mail.key.slice(6));
    } catch {
      return false;
    }
    if (context === null || typeof context !== "object") return false;
    const { recipient, post } = context as Record<string, unknown>;
    if (typeof recipient !== "string" || typeof post !== "string") return false;
    return (
      (await application.form(theMailEligibility({ recipient, post, queued: mail.recipient }))) !==
      null
    );
  };
}
