import { Link } from "@/components/link";
import { Button } from "@/components/ui/button";

/** The one sentence a screen says when its sign-in has ended. */
export const SIGN_IN_ENDED = "Your sign-in ended.";

/**
 * Said once, in place, when a session-bearing call is refused as unsigned: a
 * sign-in lasts one day and nothing extends it. The screen keeps what it
 * shows; signing in returns to it, and nothing held on the server is lost.
 */
export function SignInEnded({
  next,
  className,
}: {
  /** The address to come back to after signing in. */
  next: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm ${className ?? ""}`}
    >
      <span>{SIGN_IN_ENDED}</span>
      <Button size="sm" variant="outline" asChild>
        <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </Button>
    </div>
  );
}
