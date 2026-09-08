"use client";

import { useEffect, useRef } from "react";

/** Scroll after the asynchronously loaded overview mounts its destination. */
export function RunsHeading() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const scroll = () => {
      if (window.location.hash !== "#runs") return;
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
      heading.current?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(scroll);
    window.addEventListener("hashchange", scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scroll);
    };
  }, []);
  return (
    <h2
      ref={heading}
      id="runs"
      tabIndex={-1}
      className="scroll-mt-24 font-display text-xl font-semibold focus:outline-none"
    >
      Runs
    </h2>
  );
}
