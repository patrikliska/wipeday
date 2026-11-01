/**
 * A token bucket per player on `POST /api/commands` (docs/redesign/09-architecture.md 9.7):
 * 10 a second, burst 30. It bounds CPU and disk against a runaway tab; the domain's own tap
 * bucket is what bounds credit (D134). Over the limit the API answers 429 `slow_down` with the
 * wait, and the client retries with the same key. In memory: one API process.
 */
export class RateLimiter {
  private readonly buckets = new Map<number, { tokens: number; at: number }>();

  constructor(
    private readonly perSecond = 10,
    private readonly burst = 30,
  ) {}

  /** Takes one token for `player` at `nowMs`. Returns 0, or the milliseconds to wait. */
  take(player: number, nowMs: number): number {
    const bucket = this.buckets.get(player) ?? { tokens: this.burst, at: nowMs };
    const tokens = Math.min(
      this.burst,
      bucket.tokens + ((nowMs - bucket.at) / 1000) * this.perSecond,
    );
    if (tokens < 1) {
      this.buckets.set(player, { tokens, at: nowMs });
      return Math.ceil(((1 - tokens) / this.perSecond) * 1000);
    }
    this.buckets.set(player, { tokens: tokens - 1, at: nowMs });
    return 0;
  }
}
