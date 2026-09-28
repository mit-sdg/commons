"use client";

import { type ReactNode, useEffect, useSyncExternalStore } from "react";

let hovered: { content: ReactNode; target: Element } | null = null;
const hoverListeners = new Set<() => void>();

const HOVER_CARD = "grades-hover-card";

export function setHovered(next: typeof hovered) {
  hovered = next;
  for (const notify of hoverListeners) notify();
}

function subscribeHover(notify: () => void) {
  hoverListeners.add(notify);
  return () => {
    hoverListeners.delete(notify);
  };
}

export function hoverable(content: () => ReactNode) {
  const show = (target: Element) => setHovered({ content: content(), target });
  return {
    "aria-describedby": HOVER_CARD,
    onPointerEnter: (event: React.PointerEvent) => show(event.currentTarget),
    onPointerLeave: () => setHovered(null),
    onFocus: (event: React.FocusEvent) => show(event.currentTarget),
    onBlur: () => setHovered(null),
  };
}

export function HoverCard() {
  const current = useSyncExternalStore(
    subscribeHover,
    () => hovered,
    () => null,
  );
  useEffect(() => {
    const hide = () => setHovered(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    window.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", hide);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  if (!current?.target.isConnected) return null;
  const rect = current.target.getBoundingClientRect();
  const below = rect.bottom + 180 < window.innerHeight;
  return (
    <div
      id={HOVER_CARD}
      role="tooltip"
      className="pointer-events-none fixed z-50 grid w-72 gap-1 rounded-lg border border-border bg-card p-3 text-sm shadow-lg"
      style={{
        left: Math.min(
          Math.max(8, rect.left + rect.width / 2 - 144),
          window.innerWidth - 296,
        ),
        ...(below
          ? { top: rect.bottom + 8 }
          : { bottom: window.innerHeight - rect.top + 8 }),
      }}
    >
      {current.content}
    </div>
  );
}
