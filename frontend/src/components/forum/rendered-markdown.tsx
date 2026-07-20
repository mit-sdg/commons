import { cn } from "@/lib/utils";

export function RenderedMarkdown({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn("prose-forum", className)}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized server-side by Formatting.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
