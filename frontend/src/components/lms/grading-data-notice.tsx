import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GradingDataNotice({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;
  if (error)
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="space-y-1">
          <p className="font-medium">Grading data could not be refreshed</p>
          <p className="text-muted-foreground">
            {error} Last loaded grades remain visible. Retry before making
            changes.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={onRetry}
        >
          {loading ? "Retrying…" : "Retry grading data"}
        </Button>
      </div>
    );
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-muted-foreground text-sm"
    >
      <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      <span>Refreshing grading data… Grade changes are paused.</span>
    </div>
  );
}
