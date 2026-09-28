import { cn } from "@/lib/utils";

/** The devices on the participant link heard in the last minute, and how many hold the open round. */
export interface Room {
  here: number;
  onOpenRound: number;
}

/**
 * How long a round stands open to the room before the line counts who is not
 * on it: a phone says it holds a round once the round is on its screen, a
 * scattered moment after, up to one poll.
 */
export const ROOM_WAIT_MS = 10_000;

/** The round open to the room, and when this screen first saw it open. */
export interface SeenOpen {
  round: string;
  at: number;
}

/** The open round as this screen has seen it; a round it had not seen open starts its wait at `at`. */
export function seenOpen(
  seen: SeenOpen | null,
  round: string | null,
  at: number,
): SeenOpen | null {
  if (round === null) return null;
  return seen?.round === round ? seen : { round, at };
}

/**
 * What the dashboard says about the room: how many are here, and, once a
 * round has been open to the room for `ROOM_WAIT_MS`, how many of them do not
 * have it on their screens yet.
 */
export function roomLine(
  room: Room,
  round: number | null,
  waited: number,
): string {
  const here = `${room.here} here`;
  if (round === null || waited < ROOM_WAIT_MS) return here;
  const missing = room.here - Math.min(room.onOpenRound, room.here);
  if (missing === 0) return here;
  return `${here}, ${missing} ${missing === 1 ? "doesn’t" : "don’t"} have round ${round} yet`;
}

/** The room's one quiet line, beside the wall's figures; the run read fills it. */
export function RoomLine({
  room,
  round,
  waited,
  className,
}: {
  room: Room;
  /** The open round's number, or null while no round is open. */
  round: number | null;
  /** How long this screen has seen that round open, in milliseconds. */
  waited: number;
  className?: string;
}) {
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      {roomLine(room, round, waited)}
    </p>
  );
}
