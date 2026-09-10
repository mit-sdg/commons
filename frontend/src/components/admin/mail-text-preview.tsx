import type { InvitationPreview } from "@/lib/mail-ui";

/** Text nodes only: no HTML, Markdown, remote media, or active credential links. */
export function MailTextPreview({
  subject,
  text,
  recipient,
}: Pick<InvitationPreview, "subject" | "text"> & { recipient?: string }) {
  return (
    <article className="min-w-0 rounded-lg border border-border bg-background p-4 sm:p-6 [overflow-wrap:anywhere]">
      <dl className="space-y-2 border-b border-border pb-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Subject</dt>
          <dd className="mt-1 font-semibold">{subject}</dd>
        </div>
        {recipient ? (
          <div>
            <dt className="text-xs text-muted-foreground">To</dt>
            <dd className="mt-1">{recipient}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7">
        {text || (
          <span className="text-muted-foreground">No message text.</span>
        )}
      </div>
    </article>
  );
}
