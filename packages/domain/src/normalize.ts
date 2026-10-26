/**
 * Brings a stored base up to the current shape (D73's pattern, a clean version;
 * docs/redesign/09-architecture.md 3.3).
 *
 * - A base of any other version than 2 (every W-phase base) returns null: the API then builds a
 *   fresh base, saves it in place with the version raised and logs `base_reset`. That is the
 *   safety net behind the cut-over's wipe.
 * - Within version 2, each phase adds fields with defaults: a deep merge over a fresh base's
 *   shape fills whatever is missing, and ids the content no longer knows are dropped.
 * - R2 moved the shelf's Line Mk rows into the Workshop (D194): a stored `{line}_mk2` or
 *   `{line}_mk3` becomes that many levels of `{line}_mk`; Workshop levels stay within each item's.
 * - R3's cards: unknown survivors and gear are dropped, stars stay 1-5, gear is worn only by an
 *   owned survivor and one card a slot.
 *
 * Idempotent: a current state passes through unchanged.
 */
import type { Content } from "@wipe-day/content/schema";
import { type BaseState, type Meta, newBase } from "./state";

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
  const shelf = new Set(content.upgrades.map((upgrade) => upgrade.id));
  const research: Record<string, number> = {};
  for (const id of state.run.upgrades) {
    const mk = /^(.+)_mk([23])$/.exec(id);
    if (mk) research[`${mk[1]}_mk`] = Math.max(research[`${mk[1]}_mk`] ?? 0, Number(mk[2]) - 1);
  }
  for (const [id, n] of Object.entries(state.run.research)) research[id] = n;
  const levels: Record<string, number> = {};
  for (const def of content.research) {
    const n = Math.min(def.levels, Math.floor(research[def.id] ?? 0));
    if (n > 0) levels[def.id] = n;
  }
  return {
    ...state,
    meta: { ...state.meta, cards: cardsOf(content, state.meta.cards) },
    run: {
      ...state.run,
      lines: keep(state.run.lines),
      readyAt: keep(state.run.readyAt),
      hands: state.run.hands.filter((id) => known.has(id)),
      upgrades: state.run.upgrades.filter((id) => shelf.has(id)),
      research: levels,
    },
  };
}

/** The stored cards with unknown ids, stars out of range and impossible wear dropped. */
function cardsOf(content: Content, cards: Meta["cards"]): Meta["cards"] {
  const top = content.cards.stars.costs.length + 1;
  const survivors: Record<string, number> = {};
  for (const row of content.cards.survivors) {
    const stars = cards.survivors[row.id];
    if (typeof stars === "number" && stars >= 1)
      survivors[row.id] = Math.min(top, Math.floor(stars));
  }
  const gear: Record<string, string | null> = {};
  const slots = new Set<string>();
  for (const row of content.cards.gear) {
    if (!(row.id in cards.gear)) continue;
    const wearer = cards.gear[row.id] ?? null;
    const ok =
      wearer !== null && survivors[wearer] !== undefined && !slots.has(`${wearer}|${row.slot}`);
    if (ok) slots.add(`${wearer}|${row.slot}`);
    gear[row.id] = ok ? wearer : null;
  }
  const same =
    Object.keys(survivors).length === Object.keys(cards.survivors).length &&
    Object.entries(survivors).every(([id, n]) => cards.survivors[id] === n) &&
    Object.keys(gear).length === Object.keys(cards.gear).length &&
    Object.entries(gear).every(([id, w]) => cards.gear[id] === w);
  return same ? cards : { survivors, gear };
}
