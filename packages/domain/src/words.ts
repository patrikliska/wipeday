/**
 * Words for what happens, shared by every client (W8): the web's feed and the Discord
 * channel tell the same event in the same sentence, and every number on either goes
 * through one formatter. Strings come from the locale; nothing here reads a clock.
 */
import type { Locale, LocaleArgs } from "@wipe-day/content/locale";
import type { Amounts, Content } from "@wipe-day/content/schema";
import type { FeedEvent } from "./feed";

/** `12.4k`, `1.2M`: the one number formatter. Rounds toward zero. */
export function abbrev(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const magnitude = Math.trunc(Math.abs(amount));
  if (magnitude < 1000) return `${sign}${magnitude}`;
  const units = ["k", "M", "B"];
  let divisor = 1000;
  let unit = 0;
  while (magnitude / divisor >= 1000 && unit + 1 < units.length) {
    divisor *= 1000;
    unit += 1;
  }
  const whole = Math.floor(magnitude / divisor);
  const tenths = Math.floor((magnitude % divisor) / (divisor / 10));
  return whole >= 100 || tenths === 0
    ? `${sign}${whole}${units[unit]}`
    : `${sign}${whole}.${tenths}${units[unit]}`;
}

/** `2d 4h`, `3h 20m`, `45s`. */
export function duration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor(seconds / 3_600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

export interface Words {
  t: (key: string, args?: LocaleArgs) => string;
  resourceName: (id: string) => string;
  itemName: (id: string) => string;
  /** A recipe's output by name: a part (a resource) or an item. */
  outputName: (id: string) => string;
  tierName: (id: string) => string;
  regionName: (id: string) => string;
  siteName: (id: string) => string;
  survivorName: (id: string) => string;
  /** "+214 Timber" lines for the biggest few gains, biggest first. */
  gainLines: (gained: Amounts, limit: number) => string[];
  /** One line of the feed, about `who` (a player's name, or "You"). */
  feedLine: (event: FeedEvent, who: string) => string;
}

export function words(locale: Locale, content: Content): Words {
  const t = (key: string, args?: LocaleArgs): string => locale.t(key, args);
  const items = new Set(content.items.map((item) => item.id));
  const resourceName = (id: string) => t(`resource.${id}.name`);
  const itemName = (id: string) => t(`item.${id}.name`);
  const outputName = (id: string) => (items.has(id) ? itemName(id) : resourceName(id));
  const tierName = (id: string) => t(`base_tier.${id}.name`);
  const regionName = (id: string) => t(`region.${id}.name`);
  const siteName = (id: string) => t(`site.${id}.name`);
  const survivorName = (id: string) => t(`crew.${id}.name`);

  const gainLines = (gained: Amounts, limit: number): string[] =>
    Object.entries(gained)
      .filter(([, amount]) => amount >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, amount]) => `+${abbrev(amount)} ${resourceName(id)}`);

  const feedLine = (event: FeedEvent, who: string): string => {
    switch (event.type) {
      case "mission_back":
        return t(`feed.trip_${event.outcome === "success" ? "success" : "partial"}`, {
          who,
          site: siteName(event.target),
        });
      case "survivor_arrived":
        return t("feed.rescued", { who, name: survivorName(event.survivor) });
      case "build_done":
        return t("feed.tier", { who, tier: tierName(event.tier) });
      case "level_up":
        return t("feed.level_up", { who, name: survivorName(event.survivor), level: event.level });
      case "blueprint_found":
        return t("feed.blueprint", { who, item: outputName(event.recipe) });
      case "item_found":
        return t("feed.found", { who, item: itemName(event.item), site: siteName(event.from) });
      case "sold":
        return t("feed.sold", {
          who,
          amount: abbrev(event.amount),
          good: outputName(event.good),
          price: abbrev(event.price),
        });
      case "big_win":
        return t("feed.big_win", {
          who,
          payout: abbrev(event.payout),
          game: t(`casino.game.${event.game}`),
        });
      case "jackpot_won":
        return t("feed.jackpot", { who, amount: abbrev(event.amount) });
      case "raid_landed":
        return t(`feed.raid_${event.report.outcome}`, { who });
      case "raid_launched":
        return t(`feed.pvp_${event.report.outcome}`, { who, target: event.targetName });
      case "signal_lit":
        return t("feed.signal_lit", { who });
    }
  };

  return {
    t,
    resourceName,
    itemName,
    outputName,
    tierName,
    regionName,
    siteName,
    survivorName,
    gainLines,
    feedLine,
  };
}
