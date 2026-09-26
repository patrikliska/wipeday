/**
 * The one number formatter. Cards, text and buttons all go through here so
 * `12.4k` is never `12,412` somewhere else.
 */

const UNITS = ["k", "M", "B", "T"] as const;

/**
 * Abbreviates an amount: `999`, `1.2k`, `12.4k`, `123k`, `1.2M`.
 *
 * Always rounds toward zero. A player holding 1 999 stone must read `1.9k`,
 * not `2k`, or "Upgrade · need 2k stone" looks affordable when it is not.
 */
export function abbrev(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.trunc(Math.abs(amount));
  if (magnitude < 1000) return `${sign}${magnitude}`;

  let divisor = 1000;
  let unit = 0;
  while (magnitude / divisor >= 1000 && unit + 1 < UNITS.length) {
    divisor *= 1000;
    unit += 1;
  }
  const whole = Math.floor(magnitude / divisor);
  const tenths = Math.floor((magnitude % divisor) / (divisor / 10));
  const suffix = UNITS[unit] ?? "";
  return whole >= 100 || tenths === 0
    ? `${sign}${whole}${suffix}`
    : `${sign}${whole}.${tenths}${suffix}`;
}

/** A gain or loss shown to the player: `+214`, `-1.2k`. Zero is `+0`. */
export function delta(amount: number): string {
  return amount < 0 ? abbrev(amount) : `+${abbrev(amount)}`;
}

/** An hourly rate: `+120/h`. */
export function perHour(amount: number): string {
  return `${delta(amount)}/h`;
}

/**
 * A static duration for rendered cards, two units at most: `45s`, `12m`,
 * `2h 5m`, `3d 4h`.
 *
 * Messages use Discord `<t:..:R>` timestamps instead; a PNG cannot tick, so
 * cards show durations only where they do not go stale (costs, totals).
 */
export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds / 3_600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

/** `<t:UNIX:R>`: a live countdown rendered by the Discord client. */
export function relativeTimestamp(unixSeconds: number): string {
  return `<t:${Math.trunc(unixSeconds)}:R>`;
}
