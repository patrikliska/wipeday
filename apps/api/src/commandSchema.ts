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
    count: z.union([
      z.literal(1),
      z.literal(10),
      z.literal(100),
      z.literal("max"),
      z.literal("next"),
    ]),
  }),
  z.strictObject({ type: z.literal("hire_hand"), line: id }),
  z.strictObject({ type: z.literal("buy_upgrade"), upgrade: id }),
  z.strictObject({
    type: z.literal("buy_research"),
    item: id,
    count: z.union([z.literal(1), z.literal("max")]),
  }),
  z.strictObject({ type: z.literal("buy_era"), era: id }),
  z.strictObject({
    type: z.literal("claim_flotsam"),
    run: z.int().min(1).max(1e9),
    k: z.int().min(0).max(1e9),
  }),
  z.strictObject({
    type: z.literal("claim_gull"),
    run: z.int().min(1).max(1e9),
    k: z.int().min(0).max(1e9),
  }),
  z.strictObject({
    type: z.literal("open_drop"),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    pull: z.int().min(0).max(1e9),
  }),
  z.strictObject({ type: z.literal("star_up"), survivor: id, to: z.int().min(2).max(5) }),
  z.strictObject({ type: z.literal("craft_gear"), gear: id }),
  z.strictObject({ type: z.literal("equip_gear"), gear: id, survivor: id.nullable() }),
  z.strictObject({ type: z.literal("claim_order"), run: z.int().min(1).max(1e9), id }),
  z.strictObject({ type: z.literal("claim_quest"), day: z.int().min(0).max(1e9), id }),
  z.strictObject({ type: z.literal("buy_boost"), boost: id }),
  z.strictObject({ type: z.literal("buy_drop"), tier: z.union([z.literal(2), z.literal(3)]) }),
  z.strictObject({
    type: z.literal("claim_tide"),
    run: z.int().min(1).max(1e9),
    k: z.int().min(0).max(1e9),
  }),
  // R4: the Big Red and the Blast Map (a path of at most a sector's 45 nodes).
  z.strictObject({ type: z.literal("nuke"), run: z.int().min(1).max(1e9) }),
  z.strictObject({ type: z.literal("buy_node"), path: z.array(id).min(1).max(45) }),
]) satisfies z.ZodType<Command>;

/** The admin's commands (09-architecture.md 9.6), never on the player route. */
export const adminCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("grant"),
    glass: z.int().min(0).max(1e6),
    skin: id.nullable(),
    note: z.string().min(1).max(200),
  }),
  z.strictObject({ type: z.literal("respec") }),
]) satisfies z.ZodType<Command>;

/** Fails to compile while a domain command has no shape above (the error names it). */
type NoneMissing<T extends never> = T;
export type EveryCommand = NoneMissing<
  Exclude<
    Command["type"],
    z.infer<typeof commandSchema>["type"] | z.infer<typeof adminCommandSchema>["type"]
  >
>;

export const commandRequestSchema = z.strictObject({
  key: z.string().min(8).max(64),
  command: commandSchema,
});
