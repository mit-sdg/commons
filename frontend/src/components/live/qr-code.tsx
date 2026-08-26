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
  code,
  wall = false,
}: {
  url: string;
  code: string;
  wall?: boolean;
}) {
  const svg = useMemo(() => renderSVG(url, { ecc: "M", border: 2 }), [url]);
  const entry = joinEntryUrl();
  const localOnly = isLoopback(entry);
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        aria-label={`QR code for ${url}`}
        role="img"
        className={cn(
          "w-full rounded-xl bg-white p-3 shadow-sm [&>svg]:h-auto [&>svg]:w-full",
          wall ? "max-w-[min(42dvh,70vw)] rounded-2xl p-3" : "max-w-70",
        )}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is drawn locally by uqr from a same-origin URL this app builds, never from user content.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption
        className={cn(
          "flex flex-col items-center gap-1 text-center",
          wall ? "gap-2" : "gap-1",
        )}
      >
        <span
          className={cn(
            "select-all font-mono font-semibold tracking-[0.14em]",
            wall ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl",
          )}
        >
          {code}
        </span>
        <span
          className={cn(
            "select-all break-words font-mono text-muted-foreground",
            wall ? "text-lg sm:text-xl" : "text-sm",
          )}
        >
          {entry}
        </span>
        {localOnly ? (
          <span className="max-w-md text-amber-700 text-xs dark:text-amber-300">
            This address only works on this device. Set PUBLIC_ORIGIN to a
            public or LAN address before inviting participants.
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** The address a participant joins at, from the token and this page's origin. */
export function joinUrl(token: string): string {
  return `${participantOrigin()}/q/${token}`;
}

export function joinEntryUrl(): string {
  return `${participantOrigin()}/join`;
}

function participantOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_PARTICIPANT_ORIGIN?.replace(
    /\/$/,
    "",
  );
  if (configured) return configured;
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function isLoopback(address: string): boolean {
  if (address === "") return false;
  try {
    const host = new URL(address).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}
