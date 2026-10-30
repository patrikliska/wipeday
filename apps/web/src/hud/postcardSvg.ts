/**
 * The postcard's front (docs/redesign/03-the-big-red.md 8.1; D270): one pure function from the
 * press's summary and the island's look to an SVG string, so the bot can draw the same picture
 * in R8 (it moves to a package then; nothing here touches the DOM). A 3:2 card: the sky in the
 * palette of the nuke's hour, the glassy crater with its "WIPE DAY #N" sign and gull, the
 * rowboat, ash, the flight's dotted path, the title in postcard letters, a stamp with the
 * Kettle's silhouette and the gain, a round postmark.
 */

export interface PostcardLook {
  /** Wipe Day #N, or null for a small blast. */
  wipeDay: number | null;
  gain: number;
  /** The flight's id: the dotted path across the sky. */
  flight: string;
  /** Sky colours (CSS hex) at the press. */
  sky: { top: string; mid: string; horizon: string };
  night: boolean;
  /** The title's two lines. */
  greeting: string;
  place: string;
  /** The stamp's figure and the postmark's text. */
  stamp: string;
  postmark: string;
  /** Seeds the ash and the gull. */
  seed: number;
}

/** A deterministic 0..1 from `n`. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function xml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The flight's dotted path (03 8.1): the loop for Loop-the-Loop, a hop for a fizzle. */
function flightPath(flight: string): string {
  switch (flight) {
    case "loop_the_loop":
      return "M 236 150 C 220 90 150 70 120 100 C 100 120 120 150 140 135 C 160 120 140 95 120 100 C 100 105 110 140 150 150 L 230 170";
    case "sputter_drop":
      return "M 236 150 C 240 120 250 110 250 100 L 254 112 L 240 170";
    case "fizzle":
      return "M 236 150 C 240 135 252 135 256 150";
    default:
      return "M 236 150 C 200 60 110 40 80 90 C 70 110 80 125 95 118 C 140 100 190 130 230 170";
  }
}

/** The card as an SVG string, 360 × 240 units. */
export function postcardSvg(look: PostcardLook): string {
  const { sky, seed } = look;
  const small = look.wipeDay === null;
  const ash = Array.from({ length: 36 }, (_, i) => {
    const x = Math.round(hash(seed + i * 1.7) * 360);
    const y = Math.round(hash(seed * 2 + i * 3.1) * 150) + 10;
    const r = 1 + Math.round(hash(seed * 3 + i) * 1.5);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#b8b8b0" opacity="0.6"/>`;
  }).join("");
  const stars = look.night
    ? Array.from({ length: 24 }, (_, i) => {
        const x = Math.round(hash(seed * 5 + i * 2.3) * 360);
        const y = Math.round(hash(seed * 7 + i * 1.3) * 110);
        return `<circle cx="${x}" cy="${y}" r="1.2" fill="#f2f4ff" opacity="0.8"/>`;
      }).join("")
    : "";
  const sign = small
    ? ""
    : `<g transform="translate(118 158)">
        <rect x="6" y="0" width="4" height="30" fill="#5a3d26"/>
        <rect x="-16" y="-15" width="48" height="15" rx="2" fill="#c9a36b" stroke="#1b1a18" stroke-width="2"/>
        <text x="8" y="-4" text-anchor="middle" font-family="'Big Shoulders Display', 'Arial Narrow', sans-serif" font-weight="900" font-size="9" textLength="40" lengthAdjust="spacingAndGlyphs" fill="#1b1a18">WIPE DAY #${look.wipeDay}</text>
        <path d="M 2 -19 l 3 -3 l 3 3 l -2 -1 l -2 2 z" fill="#2f1822"/>
      </g>`;
  const gain = xml(look.stamp);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 240" width="360" height="240" role="img">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${sky.top}"/>
      <stop offset="0.6" stop-color="${sky.mid}"/>
      <stop offset="1" stop-color="${sky.horizon}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2f6a5a"/>
      <stop offset="1" stop-color="#6fd0a0"/>
    </linearGradient>
  </defs>
  <rect width="360" height="240" fill="url(#sky)"/>
  ${stars}
  <rect x="0" y="150" width="360" height="90" fill="#ab7e5a"/>
  <rect x="0" y="150" width="360" height="6" fill="#d6a26a"/>
  <path d="M 0 150 L 60 140 L 110 146 L 170 132 L 230 144 L 290 136 L 360 150 Z" fill="#8a919c" opacity="0.5"/>
  <ellipse cx="236" cy="168" rx="${small ? 40 : 70}" ry="${small ? 10 : 18}" fill="#2f1822"/>
  <ellipse cx="236" cy="166" rx="${small ? 36 : 64}" ry="${small ? 7 : 13}" fill="url(#glass)" opacity="0.75"/>
  <ellipse cx="236" cy="152" rx="${small ? 42 : 72}" ry="5" fill="none" stroke="#6fd0a0" stroke-width="2"/>
  <path d="${flightPath(look.flight)}" fill="none" stroke="#f4f1e8" stroke-width="2" stroke-dasharray="3 5" opacity="0.9"/>
  <g transform="translate(46 150)">
    <rect x="-18" y="-8" width="36" height="10" rx="4" fill="#502f30"/>
    <rect x="-16" y="-12" width="32" height="5" rx="2" fill="#6b8fb0"/>
    <rect x="-10" y="-20" width="2" height="12" fill="#5a3d26" transform="rotate(-20)"/>
    <rect x="8" y="-20" width="2" height="12" fill="#5a3d26" transform="rotate(20)"/>
  </g>
  ${sign}
  ${ash}
  <text x="18" y="38" font-family="'Barlow', 'Segoe UI', sans-serif" font-weight="700" font-size="14" letter-spacing="3" fill="#f4ead3" stroke="#1b1a18" stroke-width="3" paint-order="stroke">${xml(look.greeting.toUpperCase())}</text>
  <text x="18" y="74" font-family="'Big Shoulders Display', 'Arial Narrow', sans-serif" font-weight="900" font-size="36" letter-spacing="1" fill="#6fd0a0" stroke="#1b1a18" stroke-width="4" paint-order="stroke">${xml(look.place.toUpperCase())}</text>
  <g transform="translate(296 14)">
    <rect x="0" y="0" width="50" height="60" fill="#f4ead3" stroke="#e03a2f" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M 25 8 l 5 10 l -1 24 l -8 0 l -1 -24 z" fill="#a0643a"/>
    <path d="M 22 18 l 3 -10 l 3 10 z" fill="#f26a1b"/>
    <path d="M 16 42 l 5 -4 l 0 8 z M 34 42 l -5 -4 l 0 8 z" fill="#5d6368"/>
    <text x="25" y="55" text-anchor="middle" font-family="'Big Shoulders Display', 'Arial Narrow', sans-serif" font-weight="900" font-size="12" fill="#2f6a5a">${gain}</text>
  </g>
  <g transform="translate(262 46)" opacity="0.8">
    <circle cx="0" cy="0" r="22" fill="none" stroke="#1b1a18" stroke-width="2"/>
    <circle cx="0" cy="0" r="16" fill="none" stroke="#1b1a18" stroke-width="1"/>
    <text x="0" y="3" text-anchor="middle" font-family="'Barlow', 'Segoe UI', sans-serif" font-weight="700" font-size="6" fill="#1b1a18">${xml(look.postmark)}</text>
  </g>
</svg>`;
}
