/**
 * The wire shape of a command: zod checks the shape (ids, counts, ranges), the domain checks
 * the rules. `satisfies` keeps each shape inside the domain's `Command` union, and
 * `EveryCommand` fails the typecheck when a domain command is missing here.
 */
import type { Command } from "@wipe-day/domain/commands";
import { z } from "zod";

const id = z.string().min(2).max(32);
/** Whole unix seconds. */
const second = z
  .int()
  .min(0)
  .max(2 ** 40);

export const commandSchema = z.discriminatedUnion("type", [
  // The slim path (D134): at most 30 taps a second's batch on an honest client; 120 is the
  // ceiling a batch may claim, the bucket credits what it can.
  z.strictObject({
    type: z.literal("taps"),
    count: z.int().min(1).max(120),
    from: second,
    to: second,
  }),
  z.strictObject({ type: z.literal("ping") }),
  z.strictObject({ type: z.literal("collect") }),
  z.strictObject({
    type: z.literal("buy_line"),
    line: id,
    count: z.union([z.literal(1), z.literal(10), z.literal(100), z.literal("max")]),
  }),
  z.strictObject({ type: z.literal("hire_hand"), line: id }),
  z.strictObject({ type: z.literal("buy_upgrade"), upgrade: id }),
  z.strictObject({ type: z.literal("buy_era"), era: id }),
  z.strictObject({
    type: z.literal("claim_flotsam"),
    run: z.int().min(1).max(1e9),
    k: z.int().min(0).max(1e9),
  }),
]) satisfies z.ZodType<Command>;

/** Fails to compile while a domain command has no shape above (the error names it). */
type NoneMissing<T extends never> = T;
export type EveryCommand = NoneMissing<
  Exclude<Command["type"], z.infer<typeof commandSchema>["type"]>
>;

export const commandRequestSchema = z.strictObject({
  key: z.string().min(8).max(64),
  command: commandSchema,
});
