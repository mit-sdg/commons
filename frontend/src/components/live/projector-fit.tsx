/**
 * The projector's one scale. A room's screen is 1080, 720 or 768 tall and
 * nobody is there to scroll it, so every size the wall draws has to come off
 * the height it is given: the header, the type, the faces and the shelf all
 * clamp down together and the twelve piles and the join code keep their
 * places. Each size below is the wall's own size on a 1080-tall screen — the
 * geometry the design was drawn at — with the floor a back row can still
 * read. No word on the wall is smaller than 16px.
 *
 * The wall's cells are the wall's own file; the projector may only say how
 * big they stand, which is what this sheet does and nothing else.
 */
export const PROJECTOR = "wall-projector";

const FIT = String.raw`
/* The header: the run, the round, the prompt, and the one figure. */
.wall-projector .text-\[56px\] { font-size: clamp(32px, 5.19dvh, 56px); }
.wall-projector .text-\[44px\] { font-size: clamp(26px, 4.07dvh, 44px); }
.wall-projector .text-\[26px\] { font-size: clamp(16px, 2.41dvh, 26px); }
.wall-projector .size-\[60px\] { width: clamp(34px, 5.55dvh, 60px); height: clamp(34px, 5.55dvh, 60px); }
.wall-projector .text-\[38px\] { font-size: clamp(24px, 3.52dvh, 38px); }
.wall-projector .text-2xl { font-size: clamp(17px, 2.22dvh, 24px); }
.wall-projector .text-xl { font-size: clamp(16px, 1.85dvh, 20px); }
.wall-projector .text-lg { font-size: clamp(16px, 1.67dvh, 18px); }
.wall-projector .text-xs { font-size: 16px; }
.wall-projector figcaption span.font-mono.text-muted-foreground { font-size: clamp(16px, 1.6dvh, 18px); }

/* A pile's face: the wide one, then the dense one a third row asks for. */
.wall-projector .grid .text-2xl { font-size: clamp(18px, 2.96dvh, 32px); }
.wall-projector .grid .text-3xl { font-size: clamp(20px, 3.7dvh, 40px); }
.wall-projector .grid .text-xl { font-size: clamp(16px, 2.22dvh, 24px); }
.wall-projector .grid .text-lg { font-size: clamp(16px, 2.13dvh, 23px); }
.wall-projector .grid.gap-y-6 .text-\[22px\] { font-size: clamp(18px, 2.22dvh, 24px); }
.wall-projector .grid.gap-y-6 .text-3xl { font-size: clamp(20px, 2.96dvh, 32px); }
.wall-projector .grid.gap-y-6 .text-lg { font-size: clamp(16px, 1.85dvh, 20px); }

/* What the piles stand in: three rows of four, and the room they leave. */
.wall-projector .h-\[196px\] { height: clamp(150px, 23.7dvh, 256px); }
.wall-projector .h-\[160px\] { height: clamp(112px, 14.8dvh, 160px); }
.wall-projector .pt-3\.5 { padding-top: clamp(8px, 1.3dvh, 14px); }
.wall-projector .pb-3\.5 { padding-bottom: clamp(8px, 1.3dvh, 14px); }
.wall-projector .gap-9 { gap: clamp(14px, 3.33dvh, 36px); }
.wall-projector .gap-y-6 { row-gap: clamp(12px, 2.22dvh, 24px); }
.wall-projector .gap-y-\[34px\] { row-gap: clamp(14px, 3.15dvh, 34px); }
.wall-projector .pt-5 { padding-top: clamp(8px, 1.85dvh, 20px); }

/* The shelf keeps the bottom line, so it gives its height up first. */
.wall-projector .h-\[112px\] { height: clamp(72px, 10.4dvh, 112px); }
.wall-projector .max-w-\[30rem\] { max-width: clamp(180px, 25vw, 480px); }
`;

/** The sheet, on the page the projector fills and no other. */
export function ProjectorFit() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: a constant stylesheet written here, with nothing from the run in it.
  return <style dangerouslySetInnerHTML={{ __html: FIT }} />;
}
