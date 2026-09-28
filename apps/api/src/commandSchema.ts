/**
 * The wire format of `POST /api/commands`: validated here, at the edge, so the
 * domain only ever sees well-formed commands. Mirrors `Command` in
 * `@wipe-day/domain/commands`; the `satisfies` check keeps the two in step.
 */
import type { Command } from "@wipe-day/domain/commands";
import { z } from "zod";

const id = z.string().min(1).max(64);

export const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("gather") }),
  z.strictObject({ type: z.literal("collect") }),
  z.strictObject({ type: z.literal("upgrade_tool") }),
  z.strictObject({ type: z.literal("build"), what: id }),
  z.strictObject({ type: z.literal("smelt"), ore: id }),
  z.strictObject({ type: z.literal("take_out") }),
  z.strictObject({ type: z.literal("craft"), item: id }),
  z.strictObject({ type: z.literal("break_barrel") }),
  z.strictObject({
    type: z.literal("hit_node"),
    node: id,
    run: id,
    hit: z.int().min(1).max(100),
  }),
  z.strictObject({ type: z.literal("end_node_run"), node: id, run: id }),
]) satisfies z.ZodType<Command>;

export const commandRequestSchema = z.strictObject({
  /** Chosen by the client per intent and reused on every retry of it. */
  key: z.string().min(8).max(64),
  command: commandSchema,
});
