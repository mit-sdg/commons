"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardBody } from "@/components/live/pile";
import type { WallCard } from "@/components/live/rounds";
import { FLIGHT_MS } from "@/components/live/wall-motion";

/**
 * A card leaving the tray for a pile is drawn once, in a layer over the whole
 * wall, from where the tray showed it to the line it will take on the pile's
 * face, on a fixed clock with a slight arc and a lift. Nothing inside the wall
 * can clip it, and it is the same flight on every surface. The tray's card
 * leaves at takeoff; the face's line and the count arrive at landing.
 */

/** A box on the wall, relative to the wall's own corner. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Flight {
  card: WallCard;
  pile: string;
  from: Box;
  to: Box;
}

/** How long a pile stays lit after a card lands in it. */
const LIT_MS = 450;

function boxOf(wall: DOMRect, part: DOMRect): Box {
  return {
    x: part.left - wall.left,
    y: part.top - wall.top,
    width: part.width,
    height: part.height,
  };
}

/**
 * Where a card is now and where it lands, read off the wall before the move
 * is shown: the card as the tray or a face shows it, or the tray's hidden end
 * when the row has clipped it; the top line of the pile's face. No flight
 * without both.
 */
export function measure(
  wall: HTMLElement,
  card: string,
  pile: string,
): { from: Box; to: Box } | null {
  const face = wall.querySelector<HTMLElement>(`[data-face="${pile}"]`);
  if (face === null) return null;
  const here = wall.getBoundingClientRect();
  const source =
    wall.querySelector<HTMLElement>(`[data-card="${card}"]`) ??
    wall.querySelector<HTMLElement>("[data-shelf]");
  if (source === null) return null;
  const from = boxOf(here, source.getBoundingClientRect());
  if (!source.hasAttribute("data-card")) {
    // The row hides its oldest cards under its left fade; that is where the
    // card was.
    from.width = Math.min(from.width, 240);
  }
  const faceBox = boxOf(here, face.getBoundingClientRect());
  const line = face.firstElementChild?.getBoundingClientRect();
  const to: Box = {
    x: faceBox.x,
    y: faceBox.y,
    width: faceBox.width,
    height: line === undefined ? Math.min(faceBox.height, 32) : line.height,
  };
  return { from, to };
}

/** The flights in the air and the piles lit by a landing, and how to launch one. */
export function useFlights(): {
  flights: Flight[];
  /** The cards in the air, which the tray has let go and no face yet shows. */
  flying: Set<string>;
  lit: Set<string>;
  launch: (flight: Flight) => void;
} {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [lit, setLit] = useState<Set<string>>(() => new Set());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const later = useCallback((after: number, act: () => void) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      act();
    }, after);
    timers.current.add(timer);
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const launch = useCallback(
    (flight: Flight) => {
      setFlights((current) => [...current, flight]);
      later(FLIGHT_MS, () => {
        setFlights((current) => current.filter((one) => one !== flight));
        setLit((current) => new Set(current).add(flight.pile));
        later(LIT_MS, () =>
          setLit((current) => {
            const next = new Set(current);
            next.delete(flight.pile);
            return next;
          }),
        );
      });
    },
    [later],
  );

  const flying = new Set(flights.map((flight) => flight.card.card));
  return { flights, flying, lit, launch };
}

/** The layer the flights are drawn in, over the wall it is positioned on. */
export function Flights({
  flights,
  big = false,
}: {
  flights: Flight[];
  big?: boolean;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
    >
      {flights.map((flight) => (
        <motion.div
          key={flight.card.card}
          initial={{
            left: flight.from.x,
            top: flight.from.y,
            width: flight.from.width,
          }}
          animate={{
            left: flight.to.x,
            top: flight.to.y,
            width: flight.to.width,
          }}
          transition={{ duration: FLIGHT_MS / 1000, ease: [0.45, 0, 0.2, 1] }}
          className="absolute flex"
        >
          {/* The arc: the card lifts as it leaves, and sets down as it lands. */}
          <motion.div
            initial={{ y: 0, scale: 1 }}
            animate={{ y: [0, -28, 0], scale: [1, 1.05, 1] }}
            transition={{
              duration: FLIGHT_MS / 1000,
              times: [0, 0.4, 1],
              ease: "easeInOut",
            }}
            className="flex min-w-0 max-w-full"
          >
            <CardBody
              card={flight.card}
              big={big}
              lines={1}
              className="shadow-lg"
            />
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}
