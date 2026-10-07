/**
 * Placeholder icons, until real art arrives: one colour and two letters per resource,
 * the same tile in the web's panels and on the Discord bot's cards (W8).
 */

const RESOURCE_COLOR: Record<string, string> = {
  timber: "#b07840",
  stone: "#9aa0a6",
  ore: "#8c6a4f",
  ingots: "#6c97bc",
  sulfur_ore: "#c9a227",
  sulfur: "#e3c04f",
  fibre: "#7fa043",
  hide: "#8a5a3c",
  fat: "#e8d9b0",
  fuel: "#c85a2b",
  scrap: "#a49e93",
  food: "#d9774a",
  planks: "#c89a5b",
  rope: "#b8a27a",
  cloth: "#d8cfb8",
  leather: "#7a4a2c",
  charcoal: "#4a4541",
  plates: "#8fa3b5",
  frames: "#a57a45",
  gears: "#7d8a96",
  springs: "#b0b8c0",
  gunpowder: "#5a5652",
  charge: "#cd412b",
};

/** Fixed per resource, because "Iron Ore" and "Iron Ingots" share a word. */
const RESOURCE_INITIALS: Record<string, string> = {
  timber: "TI",
  stone: "ST",
  ore: "OR",
  ingots: "IN",
  sulfur_ore: "SO",
  sulfur: "SU",
  fibre: "FI",
  hide: "HI",
  fat: "FA",
  fuel: "FU",
  scrap: "SC",
  food: "FO",
  planks: "PL",
  rope: "RO",
  cloth: "CL",
  leather: "LE",
  charcoal: "CH",
  plates: "PT",
  frames: "FR",
  gears: "GE",
  springs: "SP",
  gunpowder: "GP",
  charge: "CG",
};

/** The resource's tile colour (`#rrggbb`). */
export const resourceColor = (id: string): string => RESOURCE_COLOR[id] ?? "#a49e93";

/** The resource's tile letters, or undefined when it has none fixed (use `initials`). */
export const resourceInitials = (id: string): string | undefined => RESOURCE_INITIALS[id];

/** Two letters for a placeholder tile: "Storage Crate" -> "SC". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words[1]?.[0] ?? words[0]?.[1] ?? "";
  return `${first}${second}`.toUpperCase();
}
