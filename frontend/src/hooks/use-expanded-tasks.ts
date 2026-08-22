"use client";

import { useCallback, useState } from "react";

export interface ExpandedTasks {
  isExpanded: (task: string) => boolean;
  toggle: (task: string) => void;
  /** Expands every collapsible task, or collapses them all when none are left. */
  toggleAll: () => void;
  /** How many tasks on the page have details worth collapsing. */
  expandableCount: number;
  allExpanded: boolean;
}

/**
 * Task details start collapsed so a long checklist cannot bury the next task.
 * The open set lives on the page rather than in each card so one control can
 * open and close all of them at once.
 */
export function useExpandedTasks(expandable: string[]): ExpandedTasks {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const allExpanded =
    expandable.length > 0 && expandable.every((task) => expanded.has(task));

  const isExpanded = useCallback(
    (task: string) => expanded.has(task),
    [expanded],
  );

  const toggle = useCallback((task: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(task)) next.add(task);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setExpanded(allExpanded ? new Set<string>() : new Set(expandable));
  }, [allExpanded, expandable]);

  return {
    isExpanded,
    toggle,
    toggleAll,
    expandableCount: expandable.length,
    allExpanded,
  };
}
