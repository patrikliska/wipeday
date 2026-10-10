/**
 * Numbers in state (D130). Supplies reach about 1e39 in a year, far past 2^53, so amounts are
 * finite doubles: never NaN, never Infinity. Counts (owned units, hands, nukes, taps, scrap)
 * stay integers. `finite` wraps every value that can grow without bound; `assertFiniteState`
 * walks a whole state after every simulated step and in the API's `save()`, where
 * `JSON.stringify` would quietly write Infinity as null. A later switch to a mantissa and
 * exponent type is a change behind `Amount`.
 */

/** A quantity of supplies or glass: a finite double, never negative unless named `delta`. */
export type Amount = number;

/** Returns `value`, or throws when it is NaN or ±Infinity. */
export function finite(value: Amount, what: string): Amount {
  if (!Number.isFinite(value)) throw new Error(`non-finite ${what}: ${value}`);
  return value;
}

/** Walks `state` and throws on the first non-finite number, naming its path. */
export function assertFiniteState(state: unknown, path = "state"): void {
  if (typeof state === "number") {
    if (!Number.isFinite(state)) throw new Error(`non-finite number at ${path}: ${state}`);
    return;
  }
  if (state === null || typeof state !== "object") return;
  if (Array.isArray(state)) {
    for (const [index, item] of state.entries()) assertFiniteState(item, `${path}[${index}]`);
    return;
  }
  for (const [key, value] of Object.entries(state)) assertFiniteState(value, `${path}.${key}`);
}
