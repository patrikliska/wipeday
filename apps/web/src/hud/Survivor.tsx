import { SLOTS, type Slot } from "@wipe-day/content/cards";
import type { GearDef } from "@wipe-day/content/schema";
import {
  gearOf,
  maxStars,
  nextStar,
  survivorEffects,
  survivorOf,
  wornBy,
} from "@wipe-day/domain/cards";
import type { BaseState } from "@wipe-day/domain/state";
import { useState } from "react";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, crewName, fmtFactor, lineName, t } from "../state/world";
import {
  Bust,
  cardStatLine,
  GearArt,
  gearName,
  rarityName,
  rarityStyle,
  slotName,
  survivorLine,
  survivorStatus,
  traitName,
} from "./cards";
import { send } from "./Goals";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/*
 * A survivor's sheet (12-feel.md 7.2; D260): the bust, the rarity, the trait, the line it runs
 * and whether it is on shift; the stars with "Star up · 10" (its shards against the price, 6.3
 * rules 3 and 4); the three gear slots, each opening the owned gear of its kind to equip or swap
 * (free, instant); and one line saying what the card adds to its line while hired.
 */
export function SurvivorSheet() {
  const sheet = useUi((state) => state.sheet);
  const id = useUi((state) => state.survivorSheet);
  const openSheet = useUi((state) => state.openSheet);
  const base = useWorld((state) => state.base);
  const [picking, setPicking] = useState<Slot | null>(null);
  if (sheet !== "survivor" || !id || !base) return null;
  const survivor = survivorOf(content, id);
  if (!survivor) return null;
  const close = () => openSheet(null);
  const stars = base.meta.cards.survivors[id];
  const owned = stars !== undefined;
  const line = survivorLine(survivor);
  const star = nextStar(content, base, id);
  const short = star ? Math.max(0, star.cost - star.have) : 0;
  const worn = wornBy(content, base.meta.cards, id);
  const factor = line
    ? survivorEffects(content, base.meta.cards, id, line.id)
        .filter((effect) => effect.op === "more" && effect.stat === "output")
        .reduce((product, effect) => product * effect.value, 1)
    : 1;
  const primary = star
    ? short > 0
      ? t("survivor.star_need", { n: short })
      : t("survivor.star_up", { cost: star.cost })
    : t("settings.done");
  return (
    <SheetFrame
      id="survivor"
      className="survivor-sheet card-sheet"
      title={crewName(id)}
      head={
        <p className="sub card-sub" style={rarityStyle(survivor.rarity)}>
          <span className="rarity-tag">{rarityName(survivor.rarity)}</span>
          {line ? <span>{t("survivor.line", { line: lineName(line.id) })}</span> : null}
        </p>
      }
      primary={primary}
      primaryDisabled={star !== null && short > 0}
      onPrimary={() => {
        if (star && short === 0) send({ type: "star_up", survivor: id, to: star.to });
        else if (!star) close();
      }}
      onClose={close}
    >
      <div className="card-sheet-body" style={rarityStyle(survivor.rarity)}>
        <div className="card-hero">
          <Bust id={id} box={96} dim={!owned} />
          <div className="card-hero-text">
            <span className="stars big-stars">
              {Array.from({ length: maxStars(content) }, (_, i) => (
                <Icon
                  // biome-ignore lint/suspicious/noArrayIndexKey: the pips are positional
                  key={i}
                  kind="ui"
                  id="star"
                  size={20}
                  className={i < (stars ?? 0) ? "lit" : "dark"}
                />
              ))}
            </span>
            <span className="card-status">
              {owned ? survivorStatus(base, survivor) : t("survivor.not_owned")}
            </span>
            {owned && line ? (
              <span className="card-adds">
                {base.run.hands.includes(line.id)
                  ? t("survivor.adds", { line: lineName(line.id), factor: fmtFactor(factor) })
                  : t("survivor.adds_none", { name: crewName(id) })}
              </span>
            ) : null}
          </div>
        </div>
        <dl className="card-facts">
          <div>
            <dt>{t("survivor.trait", { name: traitName(id) })}</dt>
            <dd>
              {line ? cardStatLine(survivor.trait, line.id) : ""}{" "}
              <span className="muted">{t("survivor.trait_hired")}</span>
            </dd>
          </div>
          {owned && star && line ? (
            <div>
              <dt>{t("survivor.stars")}</dt>
              <dd>
                {t("survivor.star_effect", {
                  line: lineName(line.id),
                  factor: fmtFactor(1 + content.cards.stars.perStar),
                })}
                {" · "}
                <span className="num">{t("survivor.star_have", { have: star.have })}</span>
              </dd>
            </div>
          ) : owned ? (
            <div>
              <dt>{t("survivor.stars")}</dt>
              <dd>{t("survivor.star_max")}</dd>
            </div>
          ) : null}
        </dl>
        {owned ? (
          <>
            <h3 className="sub-title">
              <span>{t("survivor.gear")}</span>
            </h3>
            <ul className="slot-list">
              {SLOTS.map((slot) => {
                const piece = worn.find((row) => row.slot === slot);
                return (
                  <SlotRow
                    key={slot}
                    slot={slot}
                    piece={piece}
                    base={base}
                    survivor={id}
                    line={line?.id ?? null}
                    open={picking === slot}
                    onToggle={() => setPicking(picking === slot ? null : slot)}
                  />
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </SheetFrame>
  );
}

/** One gear slot: the worn piece or "Empty", and, when open, the owned gear of that slot. */
function SlotRow({
  slot,
  piece,
  base,
  survivor,
  line,
  open,
  onToggle,
}: {
  slot: Slot;
  piece: GearDef | undefined;
  base: BaseState;
  survivor: string;
  line: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const options = content.cards.gear.filter(
    (row) => row.slot === slot && row.id in base.meta.cards.gear && row.id !== piece?.id,
  );
  return (
    <li className={`slot-row${open ? " open" : ""}`}>
      <button type="button" className="slot-head" aria-expanded={open} onClick={onToggle}>
        <span className="slot-glyph">
          <Icon kind="ui" id={`slot_${slot}`} size={18} />
        </span>
        {piece ? (
          <>
            <GearArt def={piece} box={36} />
            <span className="slot-text" style={rarityStyle(piece.rarity)}>
              <span className="slot-name">{gearName(piece.id)}</span>
              <span className="slot-effect">
                {line ? cardStatLine(piece.effect, line) : rarityName(piece.rarity)}
              </span>
            </span>
          </>
        ) : (
          <span className="slot-text empty">
            <span className="slot-name">{slotName(slot)}</span>
            <span className="slot-effect">{t("survivor.slot_empty")}</span>
          </span>
        )}
        <Icon kind="ui" id="chevron" size={16} className={open ? "up" : "down"} />
      </button>
      {open ? (
        <ul className="slot-options">
          {piece ? (
            <li className="slot-option">
              <GearArt def={piece} box={32} />
              <span className="slot-text">
                <span className="slot-name">{gearName(piece.id)}</span>
              </span>
              <button
                type="button"
                className="btn small"
                onClick={() => send({ type: "equip_gear", gear: piece.id, survivor: null })}
              >
                {t("survivor.unequip")}
              </button>
            </li>
          ) : null}
          {options.length === 0 && !piece ? (
            <li className="slot-option none">
              {t("survivor.slot_none", { slot: slotName(slot) })}
            </li>
          ) : null}
          {options.map((gear) => {
            const wearer = base.meta.cards.gear[gear.id];
            return (
              <li key={gear.id} className="slot-option" style={rarityStyle(gear.rarity)}>
                <GearArt def={gear} box={32} />
                <span className="slot-text">
                  <span className="slot-name">{gearName(gear.id)}</span>
                  <span className="slot-effect">
                    {line ? cardStatLine(gear.effect, line) : rarityName(gear.rarity)}
                    {wearer ? ` · ${t("survivor.worn_by", { name: crewName(wearer) })}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => send({ type: "equip_gear", gear: gear.id, survivor })}
                >
                  {t("survivor.equip")}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

export { gearOf };
