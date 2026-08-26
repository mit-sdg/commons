"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";

/**
 * The join code, rendered in the browser from the address it encodes. The
 * readable address always stands beside it, so a room that cannot scan can
 * still type.
 */
export function JoinCode({ url }: { url: string }) {
  const svg = useMemo(() => renderSVG(url, { ecc: "M", border: 2 }), [url]);
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        aria-label={`QR code for ${url}`}
        role="img"
        className="w-full max-w-70 rounded-xl bg-white p-3 shadow-sm [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="select-all break-all text-center font-mono text-lg">
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
