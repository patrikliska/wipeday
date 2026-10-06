/**
 * The wire format of `POST /api/commands`: validated here, at the edge, so the
 * domain only ever sees well-formed commands. Mirrors `Command` in
 * `@wipe-day/domain/commands`; the `satisfies` check keeps the two in step.
 */
import { DICE_OPTIONS } from "@wipe-day/content/schema";
import type { Command } from "@wipe-day/domain/commands";
import { z } from "zod";

const id = z.string().min(1).max(64);

const job = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("node"), node: id }),
  z.strictObject({ kind: z.literal("station"), station: id }),
  z.strictObject({ kind: z.literal("guard") }),
]);

export const commandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("gather") }),
  z.strictObject({ type: z.literal("collect") }),
  z.strictObject({ type: z.literal("upgrade_tool") }),
  z.strictObject({ type: z.literal("build"), what: id }),
  z.strictObject({ type: z.literal("smelt"), ore: id }),
  z.strictObject({ type: z.literal("take_out") }),
  z.strictObject({ type: z.literal("craft"), recipe: id, count: z.int().min(1).max(1000) }),
  z.strictObject({
    type: z.literal("cancel_craft"),
    station: id,
    index: z.int().min(0).max(100),
  }),
  z.strictObject({ type: z.literal("salvage"), item: id, count: z.int().min(1).max(1000) }),
  z.strictObject({ type: z.literal("serve"), meal: id }),
  z.strictObject({ type: z.literal("scout"), region: id, survivor: id }),
  z.strictObject({ type: z.literal("send_trip"), site: id, crew: z.array(id).min(1).max(5) }),
  z.strictObject({
    type: z.literal("equip"),
    survivor: id,
    slot: z.enum(["weapon", "armor"]),
    item: id.nullable(),
  }),
  z.strictObject({ type: z.literal("treat"), survivor: id, item: id }),
  z.strictObject({ type: z.literal("assign"), survivor: id, job: job.nullable() }),
  z.strictObject({ type: z.literal("rest"), survivor: id }),
  z.strictObject({ type: z.literal("rest_tired") }),
  z.strictObject({ type: z.literal("read_report"), id }),
  z.strictObject({ type: z.literal("break_barrel") }),
  z.strictObject({
    type: z.literal("hit_node"),
    node: id,
    run: id,
    hit: z.int().min(1).max(100),
  }),
  z.strictObject({ type: z.literal("end_node_run"), node: id, run: id }),
  // The Den (W5).
  z.strictObject({
    type: z.literal("market_list"),
    good: id,
    amount: z.int().min(1).max(10_000_000),
    price: z.int().min(1).max(10_000_000),
  }),
  z.strictObject({ type: z.literal("market_cancel"), listing: id }),
  z.strictObject({ type: z.literal("market_buy"), listing: z.int().min(1) }),
  z.strictObject({ type: z.literal("den_buy"), offer: id, lots: z.int().min(1).max(100) }),
  z.strictObject({ type: z.literal("deliver"), contract: id }),
  z.strictObject({
    type: z.literal("wheel_bet"),
    segment: id,
    amount: z.int().min(1).max(100_000),
  }),
  z.strictObject({ type: z.literal("slots_spin"), amount: z.int().min(1).max(100_000) }),
  z.strictObject({
    type: z.literal("dice_roll"),
    option: z.enum(DICE_OPTIONS),
    amount: z.int().min(1).max(100_000),
  }),
  // Raids (W6).
  z.strictObject({ type: z.literal("repair") }),
  z.strictObject({ type: z.literal("set_pvp"), on: z.boolean() }),
  z.strictObject({ type: z.literal("raid_player"), target: z.int().min(1) }),
]) satisfies z.ZodType<Command>;

export const commandRequestSchema = z.strictObject({
  /** Chosen by the client per intent and reused on every retry of it. */
  key: z.string().min(8).max(64),
  command: commandSchema,
});
