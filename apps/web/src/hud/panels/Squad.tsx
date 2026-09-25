import { useWorld } from "../../state/store";
import type { Survivor } from "../../state/world";
import { vars } from "../util";

const PERK: Record<Survivor["perk"], string> = {
  scavenger: "Scavenger · more loot",
  medic: "Medic · heals wounds",
  demolition: "Demolition · raids",
  marksman: "Marksman · more power",
  mule: "Mule · carries more",
};

export function SquadPanel() {
  const survivors = useWorld((state) => state.survivors);
  return (
    <>
      <p className="hint">
        Your survivors work the nodes by day and rest by the fire at night. Expeditions to the ruins
        come in the next build.
      </p>
      {survivors.map((survivor) => (
        <div key={survivor.id} className="survivor" style={vars({ "--hat": survivor.hat })}>
          <span className="face" />
          <div className="grow">
            <div className="row">
              <b className="grow">{survivor.name}</b>
              <span>{PERK[survivor.perk]}</span>
            </div>
            <div
              className="bar"
              style={vars({
                "--bar-color": survivor.health < 70 ? "var(--warning)" : "var(--success)",
              })}
            >
              <i style={{ width: `${survivor.health}%` }} />
            </div>
            <span>{survivor.health} / 100 health</span>
          </div>
        </div>
      ))}
      <button type="button" className="btn" disabled>
        Send expedition · coming soon
      </button>
    </>
  );
}
