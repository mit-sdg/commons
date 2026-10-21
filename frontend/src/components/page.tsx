import { ArrowLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/components/link";
import { PageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

export function PageContainer({
  children,
  className,
  width = "default",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:py-10",
        width === "default" && "max-w-5xl",
        width === "wide" && "max-w-6xl",
        width === "narrow" && "max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A page's heading. A heading in plain text names the browser tab as well;
 * `tab` names it instead, from the most particular part to the least, for a
 * heading that is more than text or a page that shares its name with another.
 */
export function PageHeader({
  eyebrow,
  title,
  tab,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  tab?: readonly (string | null | undefined)[];
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const parts = tab ?? (typeof title === "string" ? [title] : null);
  return (
    <div
      className={cn(
        "mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      {parts ? <PageTitle parts={parts} /> : null}
      <div className="space-y-1.5">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-prose text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The way back out of a detail page. One arrow, one weight, one gap: before
 * this, four pages drew their own and one wrote the arrow as a character.
 */
export function BackLink({
  href,
  children,
  className,
  ...props
}: {
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "children" | "className">) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      <ArrowLeft className="size-4" />
      {children}
    </Link>
  );
}
