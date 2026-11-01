import { craftCost, gearOf, survivorOf, wornBy } from "@wipe-day/domain/cards";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, crewName, t } from "../state/world";
import {
  Bust,
  cardStatLine,
  cardStatShort,
  GearArt,
  gearName,
  rarityName,
  rarityStyle,
  slotName,
  survivorLine,
} from "./cards";
import { send } from "./Goals";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/*
 * A gear card's sheet (12-feel.md 7.3; D260): the art, its slot and rarity, its one stat; who
 * wears it, or "Craft · 20" with the rarity's shards against the price when it is not owned yet
 * (6.3 rules 3 and 4). Owned, it can be put on any owned survivor from here (hired ones first,
 * each with the piece it would replace); swapping is free and instant.
 */
export function GearSheet() {
  const sheet = useUi((state) => state.sheet);
  const id = useUi((state) => state.gearSheet);
  const openSheet = useUi((state) => state.openSheet);
  const base = useWorld((state) => state.base);
  if (sheet !== "gear" || !id || !base) return null;
  const gear = gearOf(content, id);
  if (!gear) return null;
  const close = () => openSheet(null);
  const owned = id in base.meta.cards.gear;
  const wearer = base.meta.cards.gear[id] ?? null;
  const cost = craftCost(content, base, id);
  const short = cost ? Math.max(0, cost.cost - cost.have) : 0;
  const primary = owned
    ? t("settings.done")
    : short > 0
      ? t("gear_sheet.craft_need", { n: short })
      : t("gear_sheet.craft", { cost: cost?.cost ?? 0 });
  // Owned survivors, the hired ones first, in content order.
  const survivors = content.cards.survivors
    .filter((row) => base.meta.cards.survivors[row.id] !== undefined)
    .sort((a, b) => Number(hired(base, b.id)) - Number(hired(base, a.id)));
  return (
    <SheetFrame
      id="gear"
      className="gear-sheet card-sheet"
      title={gearName(id)}
      head={
        <p className="sub card-sub" style={rarityStyle(gear.rarity)}>
          <span className="rarity-tag">{rarityName(gear.rarity)}</span>
          <span>{slotName(gear.slot)}</span>
        </p>
      }
      primary={primary}
      primaryDisabled={!owned && short > 0}
      onPrimary={() => {
        if (owned) close();
        else if (short === 0) send({ type: "craft_gear", gear: id });
      }}
      onClose={close}
    >
      <div className="card-sheet-body" style={rarityStyle(gear.rarity)}>
        <div className="card-hero">
          <GearArt def={gear} box={96} dim={!owned} />
          <div className="card-hero-text">
            <span className="card-stat">{cardStatShort(gear.effect)}</span>
            <span className="card-status">
              {!owned
                ? t("gear_sheet.not_owned", { rarity: rarityName(gear.rarity) })
                : wearer
                  ? t("gear_sheet.worn_by", { name: crewName(wearer) })
                  : t("gear_sheet.in_album")}
            </span>
            {!owned && cost ? (
              <span className="card-adds num">
                <Icon kind="ui" id="shard" size={14} />
                {t("gear_sheet.craft_shards", { have: cost.have, rarity: rarityName(gear.rarity) })}
              </span>
            ) : null}
          </div>
        </div>
        {owned ? (
          <>
            <h3 className="sub-title">
              <span>{t("gear_sheet.equip_to")}</span>
            </h3>
            {survivors.length === 0 ? (
              <p className="goal-note">
                <span>{t("gear_sheet.no_survivors")}</span>
              </p>
            ) : (
              <ul className="slot-options wearers">
                {survivors.map((survivor) => {
                  const line = survivorLine(survivor);
                  const current = wornBy(content, base.meta.cards, survivor.id).find(
                    (row) => row.slot === gear.slot,
                  );
                  const on = wearer === survivor.id;
                  return (
                    <li key={survivor.id} className={`slot-option${on ? " on" : ""}`}>
                      <Bust id={survivor.id} box={36} />
                      <span className="slot-text">
                        <span className="slot-name">{crewName(survivor.id)}</span>
                        <span className="slot-effect">
                          {hired(base, survivor.id)
                            ? t("survivor.on_shift")
                            : t("crew_panel.not_hired")}
                          {current && !on
                            ? ` · ${t("gear_sheet.swap", { name: gearName(current.id) })}`
                            : ""}
                          {line && !on ? ` · ${cardStatLine(gear.effect, line.id)}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() =>
                          send({ type: "equip_gear", gear: id, survivor: on ? null : survivor.id })
                        }
                      >
                        {on ? t("gear_sheet.unequip") : t("gear_sheet.equip")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </SheetFrame>
  );
}

/** Whether a survivor's hand is on shift this run. */
function hired(base: { run: { hands: readonly string[] } }, survivor: string): boolean {
  const def = survivorOf(content, survivor);
  const line = def ? survivorLine(def) : undefined;
  return line !== undefined && base.run.hands.includes(line.id);
}
