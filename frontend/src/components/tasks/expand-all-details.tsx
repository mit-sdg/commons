"use client";

import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExpandedTasks } from "@/hooks/use-expanded-tasks";

/** One control for every collapsible task on the page. */
export function ExpandAllDetails({ details }: { details: ExpandedTasks }) {
  if (details.expandableCount === 0) return null;

  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={details.toggleAll}
      >
        {details.allExpanded ? (
          <ChevronsDownUp className="size-4" />
        ) : (
          <ChevronsUpDown className="size-4" />
        )}
        {details.allExpanded
          ? "Collapse all details"
          : `Expand all details (${details.expandableCount})`}
      </Button>
    </div>
  );
}
