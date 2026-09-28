"use client";

import { useSyncExternalStore } from "react";

const held = new Map<string, boolean>();
const listeners = new Set<() => void>();

function remembered(key: string): boolean {
  const current = held.get(key);
  if (current !== undefined) return current;
  try {
    return window.localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function useRemembered(key: string) {
  const on = useSyncExternalStore(
    subscribe,
    () => remembered(key),
    () => false,
  );
  return [
    on,
    (next: boolean) => {
      held.set(key, next);
      try {
        window.localStorage.setItem(key, next ? "on" : "off");
      } catch {}
      for (const notify of listeners) notify();
    },
  ] as const;
}
