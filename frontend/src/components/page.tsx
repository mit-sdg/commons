import { ArrowLeft } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/components/link";
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

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
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
