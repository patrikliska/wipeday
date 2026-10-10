/**
 * Placeholder icons, until real art arrives: one colour and two letters per resource,
 * the same tile in the web's panels and on the Discord bot's cards (W8).
 */

const RESOURCE_COLOR: Record<string, string> = {
  supplies: "#d9a441",
  glass: "#5fc79a",
  scrap: "#c9a227",
  sea_charts: "#4f86b8",
  timber: "#b07840",
  roast: "#d9774a",
  fibre: "#7fa043",
  rope: "#b8a27a",
  planks: "#c89a5b",
  charcoal: "#4a4541",
  ingots: "#6c97bc",
  leather: "#7a4a2c",
  fuel: "#c85a2b",
  food: "#5f9ea0",
  battery: "#e3c04f",
  broadcast: "#cd6b8a",
  plates: "#8fa3b5",
  cell: "#9be564",
};

/** Fixed per resource where two names would share letters. */
const RESOURCE_INITIALS: Record<string, string> = {
  supplies: "SU",
  glass: "GL",
  scrap: "SC",
  sea_charts: "SE",
  timber: "DR",
  roast: "SF",
  fibre: "HE",
  rope: "RO",
  planks: "PL",
  charcoal: "CH",
  ingots: "IN",
  leather: "LE",
  fuel: "LO",
  food: "FC",
  battery: "BA",
  broadcast: "BR",
  plates: "SP",
  cell: "PC",
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
