/**
 * The season is over (W7): once, when the player first opens the new season. Their last
 * season's card, the legacy points it gave, what carried over, and the new season's
 * modifier. One action begins the season; the other goes to spend the points.
 */
import { useWorld } from "../state/store";
import { t } from "../state/world";
import { SeasonCard } from "./panels/Ranks";

export function SeasonOver() {
  const season = useWorld((state) => state.season);
  const seen = useWorld((state) => state.seasonSeen);
  const legacy = useWorld((state) => state.legacy);
  const welcome = useWorld((state) => state.welcomeBack);
  const markSeen = useWorld((state) => state.markSeasonSeen);
  const openPanel = useWorld((state) => state.openPanel);
  const setFeedTab = useWorld((state) => state.setFeedTab);
  const last = legacy?.seasons[0];
  // The welcome back waits behind it; a player new this season never sees it.
  if (!legacy || !last || last.season !== season.number - 1 || seen >= season.number) return null;
  if (welcome) return null;
  const kept = legacy.legacy;
  const veterans = Object.values(kept.levels).filter((veteran) => veteran.level > 1).length;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="season-over">
      <div className="glass modal season-over">
        <span className="lvl">{t("season_over.kicker", { number: last.season })}</span>
        <h2 id="season-over">{t("season_over.title", { number: last.season })}</h2>
        <SeasonCard summary={last.summary} label={t("season_over.card", { number: last.season })} />
        <p className="good">
          {t("season_over.points", { points: last.points, total: kept.points })}
        </p>
        <p className="line">
          {t("season_over.kept", { blueprints: kept.blueprints.length, veterans })}
        </p>
        {season.modifier ? (
          <p className="line">
            <b>
              {t("season_over.modifier", {
                number: season.number,
                name: t(`modifier.${season.modifier}.name`),
              })}
            </b>{" "}
            {t(`modifier.${season.modifier}.blurb`)}
          </p>
        ) : null}
        <div className="row">
          <button
            type="button"
            className="btn grow"
            onClick={() => {
              markSeen();
              openPanel("feed");
              setFeedTab("legacy");
            }}
          >
            {t("season_over.spend")}
          </button>
          <button type="button" className="btn primary grow" onClick={markSeen}>
            {t("season_over.begin", { number: season.number })}
          </button>
        </div>
      </div>
    </div>
  );
}
