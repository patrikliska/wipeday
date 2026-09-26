/**
 * Base tier ids, which double as the rarity scale for items and blueprints.
 * Ids only: each client owns its colours and display names.
 */
export const TIERS = ["twig", "wood", "stone", "metal", "hqm"] as const;
export type Tier = (typeof TIERS)[number];
