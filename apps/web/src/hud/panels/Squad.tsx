import { SURVIVORS, t } from "../../state/world";
import { vars } from "../util";

export function SquadPanel() {
  return (
    <>
      <p className="hint">{t("squad.hint")}</p>
      {SURVIVORS.map((survivor) => (
        <div key={survivor.id} className="survivor" style={vars({ "--hat": survivor.hat })}>
          <span className="face" />
          <div className="grow">
            <div className="row">
              <b className="grow">{survivor.name}</b>
              <span>
                {t(`perk.${survivor.perk}.name`)} · {t(`perk.${survivor.perk}.effect`)}
              </span>
            </div>
            <div
              className="bar"
              style={vars({
                "--bar-color": survivor.health < 70 ? "var(--warning)" : "var(--success)",
              })}
            >
              <i style={{ width: `${survivor.health}%` }} />
            </div>
            <span>{t("squad.health", { health: survivor.health })}</span>
          </div>
        </div>
      ))}
      <button type="button" className="btn" disabled>
        {t("squad.expedition_soon")}
      </button>
    </>
  );
}
