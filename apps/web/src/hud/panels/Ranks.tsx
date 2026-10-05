/**
 * The leaderboards (W5): one table per category, so a trader, an explorer and a
 * builder can each be first, with the player's own row marked; and the season card,
 * this player's season so far in a few numbers (W7 shows it again at the reset).
 */

import { TIERS } from "@wipe-day/content/tiers";
import { CATEGORIES, type Category, type SeasonSummary } from "@wipe-day/domain/leaderboard";
import { useEffect, useState } from "react";
import { useWorld } from "../../state/store";
import { abbrev, initials, t, tierName } from "../../state/world";
import { tierVar, vars } from "../util";

/** A category's number, in its own words. */
function valueLabel(category: Category, value: number): string {
  switch (category) {
    case "wealth":
    case "trader":
    case "lucky":
      return t("ranks.scrap", { amount: abbrev(value) });
    case "builder": {
      const tier = TIERS[Math.floor(value / 1000)] ?? "twig";
      return t("ranks.builder_value", { tier: tierName(tier), levels: value % 1000 });
    }
    case "explorer":
      return t("ranks.sites", { count: value });
    case "guard":
      return t("ranks.defence", { score: value });
  }
}

export function RanksPanel() {
  const ranks = useWorld((state) => state.ranks);
  const loadRanks = useWorld((state) => state.loadRanks);
  const me = useWorld((state) => state.player?.id ?? 0);
  const [category, setCategory] = useState<Category>("wealth");

  useEffect(() => {
    void loadRanks();
  }, [loadRanks]);

  if (!ranks) return <p className="hint">{t("ranks.loading")}</p>;
  const rows = ranks.boards[category];
  return (
    <>
      <SeasonCard summary={ranks.me} />
      <h3 className="section">{t("ranks.title")}</h3>
      <div className="tabs" role="tablist">
        {CATEGORIES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={category === id}
            className={`tab${category === id ? " on" : ""}`}
            onClick={() => setCategory(id)}
          >
            {t(`ranks.${id}`)}
          </button>
        ))}
      </div>
      <p className="hint">{t(`ranks.${category}_hint`)}</p>
      <ol className="ranks">
        {rows.map((row) => (
          <li key={row.playerId} className={row.playerId === me ? "mine" : undefined}>
            <span className="place num">{row.rank}</span>
            <span className="who-tile">
              {row.playerId === me ? t("hud.you") : initials(row.name)}
            </span>
            <b className="grow">{row.playerId === me ? t("feed.you") : row.name}</b>
            <span className="num">{valueLabel(category, row.value)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** One player's season in a few numbers: shareable at a glance. */
function SeasonCard({ summary }: { summary: SeasonSummary }) {
  const best = CATEGORIES.filter((category) => summary.ranks[category] === 1);
  const reached = TIERS.filter((tier) => summary.tierDays[tier] !== undefined && tier !== "twig");
  return (
    <div className="season-card" style={vars({ "--tier-color": tierVar(summary.tier) })}>
      <div className="row">
        <div className="grow">
          <span className="lvl">{t("season.title")}</span>
          <b className="tier">{t("season.tier", { tier: tierName(summary.tier) })}</b>
        </div>
        {best.length > 0 ? (
          <span className="badge-first">
            {t("season.first_in", { category: t(`ranks.${best[0]}`) })}
          </span>
        ) : null}
      </div>
      {reached.length > 0 ? (
        <p className="road">
          {reached
            .map((tier) =>
              t("season.reached", { tier: tierName(tier), day: summary.tierDays[tier] ?? 0 }),
            )
            .join(" · ")}
        </p>
      ) : null}
      <div className="stats">
        <div>
          <b className="num">{summary.sites}</b>
          <span>{t("season.sites")}</span>
        </div>
        <div>
          <b className="num">{abbrev(summary.bestHaul)}</b>
          <span>{t("season.best_haul")}</span>
        </div>
        <div>
          <b className="num">{summary.crew}</b>
          <span>{t("season.crew")}</span>
        </div>
        <div>
          <b className="num">{abbrev(summary.wealth)}</b>
          <span>{t("season.wealth")}</span>
        </div>
        <div>
          <b className="num">{abbrev(summary.traded)}</b>
          <span>{t("season.traded")}</span>
        </div>
        <div>
          <b className="num">{abbrev(summary.biggestWin)}</b>
          <span>{t("season.best_win")}</span>
        </div>
      </div>
      <p className="hint">
        {t("season.ranks", {
          wealth: summary.ranks.wealth,
          explorer: summary.ranks.explorer,
          players: summary.players,
        })}
      </p>
    </div>
  );
}
