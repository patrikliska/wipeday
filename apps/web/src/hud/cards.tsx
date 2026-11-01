import { type CardEffect, cardEffect, type Rarity, type Slot } from "@wipe-day/content/cards";
import type { GearDef, SurvivorDef } from "@wipe-day/content/schema";
import { lineOfHand, maxStars } from "@wipe-day/domain/cards";
import { eraOpen } from "@wipe-day/domain/lines";
import type { BaseState } from "@wipe-day/domain/state";
import { content, crewName, duration, fmtFactor, lineName, t, tierName } from "../state/world";
import { Icon } from "./Icon";
import { PixelArt } from "./PixelArt";
import { researchEffect } from "./rows";
import { vars } from "./util";

/*
 * What every card surface shares (R3 S3; D260-D263): the rarity colour as a CSS variable, the
 * bust or gear art with its fallback, the star pips, a card's stat in one line. Nothing here
 * sends a command.
 */

/** The rarity's colour token, as an inline variable the card classes read. */
export const rarityStyle = (rarity: Rarity) => vars({ "--rarity": `var(--rarity-${rarity})` });

export const rarityName = (rarity: Rarity): string => t(`rarity.${rarity}.name`);
export const gearName = (id: string): string => t(`gear.${id}.name`);
export const slotName = (slot: Slot): string => t(`slot.${slot}.name`);
export const traitName = (id: string): string => t(`trait.${id}.name`);

/** A survivor's bust (`bust/<id>`), the crew glyph until the art is installed (D263). */
export function Bust({ id, box, dim = false }: { id: string; box: number; dim?: boolean }) {
  return (
    <span className={`card-art bust${dim ? " dim" : ""}`} style={{ width: box, height: box }}>
      <PixelArt
        id={`bust/${id}`}
        box={box}
        fallback={<Icon kind="crew" id={id} size={Math.round(box * 0.7)} />}
      />
    </span>
  );
}

/** A gear card's art (`gear/<id>`), its slot's glyph until the art is installed (D263). */
export function GearArt({ def, box, dim = false }: { def: GearDef; box: number; dim?: boolean }) {
  return (
    <span className={`card-art gear${dim ? " dim" : ""}`} style={{ width: box, height: box }}>
      <PixelArt
        id={`gear/${def.id}`}
        box={box}
        fallback={<Icon kind="ui" id={`slot_${def.slot}`} size={Math.round(box * 0.6)} />}
      />
    </span>
  );
}

/** Five pips, `stars` of them lit (0 for a card not owned). */
export function Stars({ stars, size = 12 }: { stars: number; size?: number }) {
  const max = maxStars(content);
  return (
    <span className="stars" role="img" aria-label={t("album.stars", { n: stars, max })}>
      {Array.from({ length: max }, (_, i) => (
        <Icon
          // biome-ignore lint/suspicious/noArrayIndexKey: the pips are positional
          key={i}
          kind="ui"
          id="star"
          size={size}
          className={i < stars ? "lit" : "dark"}
        />
      ))}
    </span>
  );
}

/** What a card's one effect does on `line`, in the Workshop's words ("Campfire ×1.2"). */
export function cardStatLine(effect: CardEffect, line: string): string {
  return researchEffect(cardEffect(effect, line));
}

/** A card's effect with no line to name it on ("Output ×1.2"): the gear sheet's head. */
export function cardStatShort(effect: CardEffect): string {
  switch (effect.stat) {
    case "night_shift":
      return t("research_effect.night_shift", {
        time: duration(Math.round(effect.value * 3600)),
      });
    case "offline":
      return t("research_effect.offline", { pct: pct(effect.value - 1) });
    case "speed":
      return t("card_stat.speed", { pct: pct(effect.value - 1) });
    default:
      return t("card_stat.output", { factor: fmtFactor(effect.value) });
  }
}

const pct = (value: number): string => `${Number((value * 100).toPrecision(3))}%`;

/** The line a survivor runs, by its hand id. */
export const survivorLine = (survivor: SurvivorDef) => lineOfHand(content, survivor.id);

/** A survivor's status this run: on shift, hired, or waiting on its era. */
export function survivorStatus(base: BaseState, survivor: SurvivorDef): string {
  const line = survivorLine(survivor);
  if (!line) return "";
  if (base.run.hands.includes(line.id)) return t("survivor.on_shift");
  if (!eraOpen(base, line)) return t("survivor.opens_in", { era: tierName(line.era) });
  return t("survivor.not_hired");
}

/** "Mara · Barrel Smasher" */
export function survivorTitle(survivor: SurvivorDef): string {
  const line = survivorLine(survivor);
  return line
    ? t("crew_panel.line", { name: crewName(survivor.id), line: lineName(line.id) })
    : crewName(survivor.id);
}
