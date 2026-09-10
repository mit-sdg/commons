import { AlertTriangle, Inbox, Loader2, Lock, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-5 animate-spin", className)}
    />
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
    >
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="space-y-1">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * A refusal is not a fault. A reader who asks for a page that is not theirs
 * has met a boundary the deployment meant to hold, so it is reported the way
 * an empty shelf is, without the alarm colour or an offer to try again.
 */
const boundaries: Record<
  string,
  { title: string; icon: React.ComponentType<{ className?: string }> }
> = {
  FORBIDDEN: { title: "Not yours to open", icon: Lock },
  UNAUTHORIZED: { title: "Not yours to open", icon: Lock },
  NOT_FOUND: { title: "Nothing here", icon: SearchX },
};

export function ErrorState({
  message,
  refused,
  onRetry,
}: {
  message: string;
  refused?: string | null;
  onRetry?: () => void;
}) {
  const boundary = refused ? boundaries[refused] : undefined;
  if (boundary) {
    return (
      <EmptyState
        icon={boundary.icon}
        title={boundary.title}
        description={message}
      />
    );
  }
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
    >
      <AlertTriangle className="size-6 text-destructive" />
      <h2 className="font-display text-lg font-semibold">
        Something went wrong
      </h2>
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
