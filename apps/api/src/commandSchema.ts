/**
 * The wire shape of a command: zod checks the shape (ids, counts, ranges), the domain checks
 * the rules. `satisfies` keeps this list and the domain's `Command` union in step: a new
 * command that is missing here fails the typecheck.
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
  z.strictObject({
    type: z.literal("buy_line"),
    line: id,
    count: z.union([z.literal(1), z.literal(10), z.literal(100), z.literal("max")]),
  }),
  z.strictObject({ type: z.literal("hire_hand"), line: id }),
]) satisfies z.ZodType<Command>;

export const commandRequestSchema = z.strictObject({
  key: z.string().min(8).max(64),
  command: commandSchema,
});
