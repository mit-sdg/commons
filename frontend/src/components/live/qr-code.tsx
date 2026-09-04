"use client";

import { useMemo } from "react";
import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";

/** How big the block stands, from a sidebar panel to a whole projected wall. */
const SIZES = {
  panel: { qr: "w-full max-w-70", code: "text-3xl", url: "text-sm" },
  corner: {
    qr: "w-[clamp(5rem,11dvh,7.5rem)] flex-none",
    code: "text-[clamp(1.5rem,3.6dvh,40px)]",
    url: "text-[clamp(0.8rem,1.6dvh,1rem)]",
  },
  room: { qr: "w-46 flex-none", code: "text-[56px]", url: "text-xl" },
  wall: {
    qr: "w-full max-w-[min(42dvh,70vw)] rounded-2xl",
    code: "text-4xl sm:text-5xl lg:text-6xl",
    url: "text-2xl sm:text-3xl",
  },
} as const;

/**
 * The join code, rendered in the browser from the address it encodes. The
 * readable address always stands beside it, so a room that cannot scan can
 * still type. The wall variant fills a projected screen; corner and room are
 * the projector's two, sized to how full the wall already is. An address
 * only this machine can reach is a deployment matter, so it is said on the
 * staff panel alone and never in front of a room.
 */
export function JoinCode({
  url,
  code,
  wall = false,
  size = "panel",
}: {
  url: string;
  code: string;
  wall?: boolean;
  size?: "panel" | "corner" | "room";
}) {
  const svg = useMemo(() => renderSVG(url, { ecc: "M", border: 2 }), [url]);
  const entry = joinEntryUrl();
  const shape = wall ? "wall" : size;
  const localOnly = shape === "panel" && isLoopback(entry);
  const spec = SIZES[shape];
  const beside = shape === "corner" || shape === "room";
  return (
    <figure
      className={cn(
        "flex",
        beside ? "flex-row items-center gap-6" : "flex-col items-center gap-3",
      )}
    >
      <div
        aria-label={`QR code for ${url}`}
        role="img"
        className={cn(
          "rounded-xl bg-white p-3 shadow-sm [&>svg]:h-auto [&>svg]:w-full",
          spec.qr,
        )}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is drawn locally by uqr from a same-origin URL this app builds, never from user content.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption
        className={cn(
          "flex flex-col",
          beside ? "items-start gap-1 text-left" : "items-center text-center",
          shape === "wall" ? "gap-2" : "gap-1",
        )}
      >
        <span
          className={cn(
            "select-all font-mono font-semibold tracking-[0.14em]",
            spec.code,
          )}
        >
          {code}
        </span>
        <span
          className={cn(
            "select-all break-words font-mono text-muted-foreground",
            spec.url,
          )}
        >
          {entry}
        </span>
        {localOnly ? (
          <span className="max-w-md text-amber-700 text-xs dark:text-amber-300">
            This address works on this device only. Set PUBLIC_ORIGIN.
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
