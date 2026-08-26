"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";

/**
 * The join code, rendered in the browser from the address it encodes. The
 * readable address always stands beside it, so a room that cannot scan can
 * still type. The wall variant fills a projected screen.
 */
export function JoinCode({
  url,
  wall = false,
}: {
  url: string;
  wall?: boolean;
}) {
  const svg = useMemo(() => renderSVG(url, { ecc: "M", border: 2 }), [url]);
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        aria-label={`QR code for ${url}`}
        role="img"
        className={cn(
          "w-full rounded-xl bg-white p-3 shadow-sm [&>svg]:h-auto [&>svg]:w-full",
          wall ? "max-w-[min(55vh,85vw)] rounded-2xl p-4" : "max-w-70",
        )}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is drawn locally by uqr from a same-origin URL this app builds, never from user content.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {/* break-words lets the address break at its slashes and hyphens, so it
          stays readable aloud instead of shattering mid-token. */}
      <figcaption
        className={cn(
          "select-all break-words text-center font-mono",
          wall ? "text-2xl sm:text-3xl lg:text-4xl" : "text-sm",
        )}
      >
        {url}
      </figcaption>
    </figure>
  );
}

/** The address a participant joins at, from the token and this page's origin. */
export function joinUrl(token: string): string {
  if (typeof window === "undefined") return `/q/${token}`;
  return `${window.location.origin}/q/${token}`;
}
