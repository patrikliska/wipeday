/**
 * The Signal (W7): the island's shared tower for the season's last week. Before it opens it
 * says when it will; then the stages (foundation, tower, lamp, fuel) with the open one's
 * needs as bars and one give button per good (what you hold, up to what is left), the
 * biggest givers, and your own share. Lit: the story, and who gave most.
 */
import { seasonDay } from "@wipe-day/domain/signal";
import { useEffect } from "react";
import { useWorld } from "../../state/store";
import { abbrev, content, duration, resourceName, t } from "../../state/world";
import { ResourceIcon } from "../Icon";

export function SignalPanel() {
  const signal = useWorld((state) => state.signal);
  const loadSignal = useWorld((state) => state.loadSignal);
  const stock = useWorld((state) => state.base.stock);
  const season = useWorld((state) => state.base.season);
  const endsAt = useWorld((state) => state.season.endsAt);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const giveSignal = useWorld((state) => state.giveSignal);
  const me = useWorld((state) => state.player?.id ?? 0);
  const pending = useWorld((state) =>
    state.queue.some((queued) => !queued.predicted && queued.command.type === "signal_give"),
  );

  useEffect(() => {
    void loadSignal();
  }, [loadSignal]);

  if (!signal) return <p className="hint">{t("signal.loading")}</p>;
  const stages = content.seasons.signal.stages;
  const { progress } = signal;
  const lit = progress.litAt !== null;
  const day = seasonDay(season, now);
  const opensIn = (content.seasons.signal.opensOnDay - day) * 86400;
  const stage = stages[progress.stage];
  // The one primary button: the good you can give the most of, relative to what is left.
  const options = Object.entries(signal.needs).map(([good, left]) => ({
    good,
    left,
    give: Math.min(left, Math.floor(stock[good] ?? 0)),
  }));
  const best = [...options].sort((a, b) => b.give / b.left - a.give / a.left)[0];

  return (
    <>
      <p className="hint">{t("signal.blurb")}</p>
      <ol className="signal-stages">
        {stages.map((entry, index) => (
          <li
            key={entry.id}
            className={
              index < progress.stage ? "done" : index === progress.stage ? "now" : undefined
            }
          >
            <i aria-hidden="true">{index < progress.stage ? "✓" : index + 1}</i>
            {t(`signal.stage_${entry.id}`)}
          </li>
        ))}
      </ol>
      {lit ? (
        <div className="card signal-lit">
          <div className="main">
            <b>{t("signal.lit")}</b>
            <div className="desc">{t("signal.lit_sub")}</div>
          </div>
        </div>
      ) : !signal.open ? (
        <div className="card locked">
          <div className="main">
            <b>{t("signal.closed", { day: content.seasons.signal.opensOnDay })}</b>
            <div className="desc">
              {opensIn > 0
                ? t("signal.closed_in", { time: duration(opensIn) })
                : t("signal.closed_sub")}
            </div>
          </div>
        </div>
      ) : stage ? (
        <div className="card signal-stage">
          <div className="main">
            <div className="title">
              <b>{t(`signal.stage_${stage.id}`)}</b>
              <span className="lvl">
                {t("signal.stage_of", { stage: progress.stage + 1, stages: stages.length })}
              </span>
            </div>
            {Object.entries(stage.needs).map(([good, need]) => {
              const given = progress.given[good] ?? 0;
              return (
                <div key={good} className="need">
                  <span className="what">
                    <ResourceIcon id={good} /> {resourceName(good)}
                  </span>
                  <span className="bar">
                    <i style={{ width: `${Math.min(100, (given * 100) / need)}%` }} />
                  </span>
                  <span className="num">
                    {abbrev(given)}/{abbrev(need)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {signal.open && !lit
        ? options.map((option) => (
            <button
              key={option.good}
              type="button"
              className={`btn wide${option === best && option.give > 0 ? " primary" : ""}`}
              disabled={option.give < 1 || pending}
              onClick={() => giveSignal(option.good, option.give)}
            >
              {option.give < 1
                ? t("signal.none", { good: resourceName(option.good) })
                : t("signal.give", {
                    amount: abbrev(option.give),
                    good: resourceName(option.good),
                  })}
            </button>
          ))
        : null}
      {endsAt !== null ? (
        <p className="hint">
          {t("signal.season_ends", { time: duration(Math.max(0, endsAt - now)) })}
        </p>
      ) : null}

      <h3 className="section">{t("signal.givers")}</h3>
      {signal.top.length === 0 ? (
        <p className="hint">{t("signal.no_givers")}</p>
      ) : (
        <ol className="ranks">
          {signal.top.map((giver, index) => (
            <li key={giver.playerId} className={giver.playerId === me ? "mine" : undefined}>
              <span className="place num">{index + 1}</span>
              <b className="grow">{giver.playerId === me ? t("feed.you") : giver.name}</b>
              <span className="num">{t("ranks.scrap", { amount: abbrev(giver.worth) })}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="hint">
        {t("signal.mine", {
          amount: abbrev(signal.mine),
          points: content.legacy.points.signal,
        })}
      </p>
    </>
  );
}
