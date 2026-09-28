/**
 * The crew: who they are (traits), how far along (level, XP), what they carry,
 * and where they are: home, away on a mission, or hurt (with a Treat button).
 */
import { crewCap, levelFor, nextLevelAt } from "@wipe-day/domain/missions";
import { useWorld } from "../../state/store";
import {
  content,
  duration,
  itemName,
  regionName,
  siteName,
  survivorLook,
  t,
  traitName,
} from "../../state/world";
import { vars } from "../util";

export function SquadPanel() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now));
  const equip = useWorld((state) => state.equip);
  const treat = useWorld((state) => state.treat);
  const setView = useWorld((state) => state.setView);
  const cap = crewCap(content, base);
  const weapons = content.items.filter(
    (item) => item.category === "weapon" && (base.items[item.id] ?? 0) > 0,
  );
  const armour = content.items.filter(
    (item) => item.category === "armor" && (base.items[item.id] ?? 0) > 0,
  );
  const kit = Object.keys(content.crewRules.treat).find((id) => (base.items[id] ?? 0) > 0);

  return (
    <>
      <div className="row">
        <span className="hint grow">
          {t("squad.count", { count: base.crew.length, cap })}
          {base.crew.length < cap && base.nextArrivalAt > now
            ? ` · ${t("squad.next_boat", { time: duration(base.nextArrivalAt - now) })}`
            : ""}
        </span>
        <button type="button" className="btn small" onClick={() => setView("map")}>
          {t("action.map")}
        </button>
      </div>
      {base.crew.map((member) => {
        const look = survivorLook(member.id);
        const mission = base.missions.find((candidate) => candidate.id === member.away);
        const hurt = member.injuredUntil !== null && member.injuredUntil > now;
        const next = nextLevelAt(content, member.level);
        const from = member.level > 1 ? (content.crewRules.levels[member.level - 2] ?? 0) : 0;
        const progress = next === null ? 1 : (member.xp - from) / Math.max(1, next - from);
        const where = mission
          ? t(mission.kind === "scout" ? "squad.scouting" : "squad.on_trip", {
              place:
                mission.kind === "scout" ? regionName(mission.target) : siteName(mission.target),
              time: duration(Math.max(0, mission.endsAt - now)),
            })
          : hurt
            ? t("squad.hurt", { time: duration((member.injuredUntil ?? now) - now) })
            : t("squad.home");
        return (
          <div key={member.id} className="survivor" style={vars({ "--hat": look.hat })}>
            <span className="face" />
            <div className="grow">
              <div className="row">
                <b className="grow">{look.name}</b>
                <span className="lvl">
                  {t("squad.level", { level: levelFor(content, member.xp) })}
                </span>
              </div>
              <span>{look.traits.map(traitName).join(" · ")}</span>
              <div className="bar" style={vars({ "--bar-color": "#e3a32f" })}>
                <i style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }} />
              </div>
              <span className={hurt ? "warn" : mission ? "away" : undefined}>{where}</span>
              <div className="row gear">
                <select
                  aria-label={t("squad.weapon")}
                  value={member.gear.weapon ?? ""}
                  disabled={member.away !== null}
                  onChange={(event) => equip(member.id, "weapon", event.target.value || null)}
                >
                  <option value="">{t("squad.no_weapon")}</option>
                  {member.gear.weapon ? (
                    <option value={member.gear.weapon}>{itemName(member.gear.weapon)}</option>
                  ) : null}
                  {weapons
                    .filter((item) => item.id !== member.gear.weapon)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {itemName(item.id)}
                      </option>
                    ))}
                </select>
                <select
                  aria-label={t("squad.armor")}
                  value={member.gear.armor ?? ""}
                  disabled={member.away !== null}
                  onChange={(event) => equip(member.id, "armor", event.target.value || null)}
                >
                  <option value="">{t("squad.no_armor")}</option>
                  {member.gear.armor ? (
                    <option value={member.gear.armor}>{itemName(member.gear.armor)}</option>
                  ) : null}
                  {armour
                    .filter((item) => item.id !== member.gear.armor)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {itemName(item.id)}
                      </option>
                    ))}
                </select>
              </div>
              {hurt ? (
                <button
                  type="button"
                  className="btn small"
                  disabled={!kit}
                  onClick={() => kit && treat(member.id, kit)}
                >
                  {kit
                    ? t("squad.treat", {
                        item: itemName(kit),
                        hours: content.crewRules.treat[kit] ?? 0,
                      })
                    : t("squad.treat_none")}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </>
  );
}
