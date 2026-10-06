/**
 * The legacy layer (W7), as two tabs of "The island":
 * - Legacy: the points to spend, what carries over (blueprints, the crew's levels), the
 *   perks with their ranks and what the next rank does, and the titles and skins earned.
 *   The cap is stated where the perks are: no veteran is more than 25% stronger in any rate.
 * - Hall of fame: every finished season's winners.
 * Perks and cosmetics are server-only commands (the points live on the server).
 */
import type { Perk } from "@wipe-day/content/schema";
import { CATEGORIES, type Category } from "@wipe-day/domain/leaderboard";
import { nextRankCost } from "@wipe-day/domain/legacy";
import type { HallEntry } from "@wipe-day/domain/wire";
import { useEffect } from "react";
import { useWorld } from "../../state/store";
import { abbrev, content, survivorLook, t } from "../../state/world";

/** "+4% on all gathering" for `rank` ranks of `perk` (options say what they do). */
export function perkLine(perk: Perk, rank: number): string {
  const [field, per] = Object.entries(perk.bonus)[0] ?? [];
  if (field === undefined || per === undefined) return t(`perk.${perk.id}.effect`, { value: 0 });
  return t(`perk.${perk.id}.effect`, { value: per * Math.max(1, rank) });
}

/** "Wealthiest · season 1", "Keeper of the Signal · season 2". */
export function titleName(title: string): string {
  const [category, season] = title.split(":");
  return t("legacy.title", { name: t(`legacy.title_${category}`), season: season ?? "" });
}

export function LegacyPanel() {
  const legacy = useWorld((state) => state.legacy);
  const loadLegacy = useWorld((state) => state.loadLegacy);
  const perks = useWorld((state) => state.base.perks);
  const skin = useWorld((state) => state.base.skin);
  const season = useWorld((state) => state.season);
  const buyPerk = useWorld((state) => state.buyPerk);
  const setCosmetic = useWorld((state) => state.setCosmetic);
  const pending = useWorld((state) =>
    state.queue.some((queued) => !queued.predicted && queued.command.type === "buy_perk"),
  );

  useEffect(() => {
    void loadLegacy();
  }, [loadLegacy]);

  if (!legacy) return <p className="hint">{t("legacy.loading")}</p>;
  const { legacy: kept } = legacy;
  const veterans = Object.entries(kept.levels)
    .filter(([, veteran]) => veteran.level > 1)
    .sort((a, b) => b[1].xp - a[1].xp);

  return (
    <>
      <div className="card legacy-head">
        <div className="score">
          <b className="num">{kept.points}</b>
          <span>{t("legacy.points")}</span>
        </div>
        <div className="main">
          <b>
            {t("legacy.season", { number: season.number })}
            {season.modifier ? ` · ${t(`modifier.${season.modifier}.name`)}` : ""}
          </b>
          <div className="desc">
            {kept.seasons === 0
              ? t("legacy.first_season")
              : t("legacy.finished", { count: kept.seasons })}
          </div>
          <div className="desc">
            {t("legacy.kept", { blueprints: kept.blueprints.length, veterans: veterans.length })}
          </div>
        </div>
      </div>
      {veterans.length > 0 ? (
        <div className="chips">
          {veterans.slice(0, 6).map(([id, veteran]) => (
            <span key={id} className="chip-tag">
              {t("legacy.veteran", { name: survivorLook(id).name, level: veteran.level })}
            </span>
          ))}
        </div>
      ) : null}

      <h3 className="section">{t("legacy.perks")}</h3>
      <p className="hint">{t("legacy.cap", { percent: content.legacy.capPercent })}</p>
      {content.legacy.perks.map((perk) => {
        const rank = perks[perk.id] ?? 0;
        const cost = nextRankCost(perk, rank);
        const top = perk.cost.length;
        const short = cost !== null ? cost - kept.points : 0;
        return (
          <div key={perk.id} className="card perk">
            <div className="main">
              <div className="title">
                <b>{t(`perk.${perk.id}.name`)}</b>
                <span className="pips" role="img" aria-label={t("legacy.rank", { rank, top })}>
                  {perk.cost
                    .map((_, step) => `${perk.id}:${step + 1}`)
                    .map((pip) => (
                      <i
                        key={pip}
                        className={Number(pip.split(":")[1]) <= rank ? "on" : undefined}
                      />
                    ))}
                </span>
              </div>
              <div className="desc">
                {rank > 0 ? perkLine(perk, rank) : t("legacy.not_yet")}
                {cost !== null && rank > 0 && perk.cost.length > 1
                  ? ` → ${perkLine(perk, rank + 1)}`
                  : ""}
                {rank === 0 ? ` · ${perkLine(perk, 1)}` : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn small"
              disabled={cost === null || short > 0 || pending}
              onClick={() => buyPerk(perk.id)}
            >
              {cost === null
                ? t("legacy.top")
                : short > 0
                  ? t("legacy.need", { count: short })
                  : t("legacy.buy", { cost })}
            </button>
          </div>
        );
      })}

      <h3 className="section">{t("legacy.skins")}</h3>
      <div className="chips">
        <button
          type="button"
          className={`chip-tag pick${skin === null ? " on" : ""}`}
          onClick={() => setCosmetic({ skin: null })}
        >
          {t("legacy.plain")}
        </button>
        {content.legacy.skins.map((option) => {
          const earned = kept.skins.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className={`chip-tag pick${skin === option.id ? " on" : ""}`}
              disabled={!earned}
              title={
                earned ? undefined : t(`skin.${option.id}.how`, { count: option.defended ?? 0 })
              }
              onClick={() => setCosmetic({ skin: option.id })}
            >
              {t(`skin.${option.id}.name`)}
              {earned ? "" : ` · ${t(`skin.${option.id}.how`, { count: option.defended ?? 0 })}`}
            </button>
          );
        })}
      </div>

      <h3 className="section">{t("legacy.titles")}</h3>
      {kept.titles.length === 0 ? (
        <p className="hint">{t("legacy.no_titles")}</p>
      ) : (
        <div className="chips">
          {kept.titles.map((title) => (
            <button
              key={title}
              type="button"
              className={`chip-tag pick${kept.title === title ? " on" : ""}`}
              onClick={() => setCosmetic({ title: kept.title === title ? null : title })}
            >
              {titleName(title)}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** A winner's number, in its category's words. */
function hallValue(entry: HallEntry): string {
  if (entry.category === "signal") return t("ranks.scrap", { amount: abbrev(entry.value) });
  if ((CATEGORIES as readonly string[]).includes(entry.category))
    return t(`hall.value_${entry.category as Category}`, { value: abbrev(entry.value) });
  return abbrev(entry.value);
}

export function HallPanel() {
  const legacy = useWorld((state) => state.legacy);
  const loadLegacy = useWorld((state) => state.loadLegacy);
  const me = useWorld((state) => state.player?.id ?? 0);

  useEffect(() => {
    void loadLegacy();
  }, [loadLegacy]);

  if (!legacy) return <p className="hint">{t("legacy.loading")}</p>;
  const seasons = [...new Set(legacy.hall.map((entry) => entry.season))].sort((a, b) => b - a);
  if (seasons.length === 0) return <p className="hint">{t("hall.empty")}</p>;
  return (
    <>
      <p className="hint">{t("hall.hint")}</p>
      {seasons.map((season) => (
        <div key={season} className="card hall">
          <div className="main">
            <b>{t("hall.season", { number: season })}</b>
            <ol className="ranks">
              {legacy.hall
                .filter((entry) => entry.season === season)
                .map((entry) => (
                  <li
                    key={`${entry.category}-${entry.playerId}`}
                    className={entry.playerId === me ? "mine" : undefined}
                  >
                    <span className="grow">
                      {entry.category === "signal"
                        ? t("hall.signal")
                        : t(`ranks.${entry.category}`)}
                    </span>
                    <b>{entry.playerId === me ? t("feed.you") : entry.name}</b>
                    <span className="num">{hallValue(entry)}</span>
                  </li>
                ))}
            </ol>
          </div>
        </div>
      ))}
    </>
  );
}
