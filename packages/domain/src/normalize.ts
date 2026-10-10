/**
 * Brings a stored base up to the current shape (D73's pattern, a clean version;
 * docs/redesign/09-architecture.md 3.3).
 *
 * - A base of any other version than 2 (every W-phase base) returns null: the API then builds a
 *   fresh base, saves it in place with the version raised and logs `base_reset`. That is the
 *   safety net behind the cut-over's wipe.
 * - Within version 2, each phase adds fields with defaults: a deep merge over a fresh base's
 *   shape fills whatever is missing, and ids the content no longer knows are dropped.
 *
 * Idempotent: a current state passes through unchanged.
 */
import type { Content } from "@wipe-day/content/schema";
import { type BaseState, newBase } from "./state";

type Plain = Record<string, unknown>;

const isPlain = (value: unknown): value is Plain =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** `stored` over `shape`: objects merge key by key; anything else from `stored` wins. */
function merge(shape: unknown, stored: unknown): unknown {
  if (stored === undefined) return shape;
  if (!isPlain(shape) || !isPlain(stored)) return stored;
  const out: Plain = { ...stored };
  for (const [key, value] of Object.entries(shape)) out[key] = merge(value, stored[key]);
  return out;
}

export function normalizeState(content: Content, stored: unknown): BaseState | null {
  if (!isPlain(stored) || stored.v !== 2) return null;
  const createdAt = typeof stored.createdAt === "number" ? stored.createdAt : 0;
  const seed = typeof stored.seed === "number" ? stored.seed : 1;
  const state = merge(newBase(content, createdAt, seed), stored) as BaseState;
  const known = new Set(content.lines.map((line) => line.id));
  const keep = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([id]) => known.has(id)));
  return {
    ...state,
    run: {
      ...state.run,
      lines: keep(state.run.lines),
      readyAt: keep(state.run.readyAt),
      hands: state.run.hands.filter((id) => known.has(id)),
    },
  };
}
