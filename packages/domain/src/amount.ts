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

/** The path of the first non-finite number in `value`, or null when every number is finite. */
function firstNonFinite(value: unknown): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? null : "";
  if (value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      const found = firstNonFinite(value[index]);
      if (found !== null) return `[${index}]${found}`;
    }
    return null;
  }
  for (const key in value) {
    const found = firstNonFinite((value as Record<string, unknown>)[key]);
    if (found !== null) return `.${key}${found}`;
  }
  return null;
}

/** Walks `state` and throws on the first non-finite number, naming its path. */
export function assertFiniteState(state: unknown, path = "state"): void {
  const found = firstNonFinite(state);
  if (found !== null) throw new Error(`non-finite number at ${path}${found}`);
}
