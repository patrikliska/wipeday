import { DROP_TIERS, RARITIES, type Rarity, SLOTS } from "@wipe-day/content/cards";
import type { Effect } from "@wipe-day/content/effects";
import type { GearDef, SurvivorDef } from "@wipe-day/content/schema";
import { TIERS, type Tier } from "@wipe-day/content/tiers";
import {
  albumCounts,
  heldDrops,
  pityView,
  setComplete,
  setProgress,
  survivorOf,
} from "@wipe-day/domain/cards";
import { dropsOnWay } from "@wipe-day/domain/drops";
import type { BaseState } from "@wipe-day/domain/state";
import { duration } from "@wipe-day/domain/words";
import { useEffect } from "react";
import { useReveal } from "../state/reveal";
import { type AlbumTab, useUi } from "../state/ui";
import { content, crewName, fmtFactor, t, tierName } from "../state/world";
import { Bust, GearArt, rarityName, rarityStyle, Stars, slotName } from "./cards";
import { OnWay } from "./Goals";
import { Icon } from "./Icon";
import { researchEffect } from "./rows";
import { useRise, vars } from "./util";

/*
 * The Album (12-feel.md 7.4; D260): a dock destination from the first Supply Drop. One head
 * (how full it is, the drops waiting to be opened), then three segments. Crew: the 14 survivors
 * as portraits, greyed until found, their stars under each, and the crew sets under them. Gear:
 * the 30 gear cards by slot. Odds: the printed odds per drop tier, the pity counters as bars,
 * the shard balances (guardrail 9: nothing hidden). Tapping a card opens its sheet.
 */

const TABS: readonly AlbumTab[] = ["crew", "gear", "odds"];

/** How many cards are owned: what the dock's Album badge counts against `albumSeen`. */
export function cardsOwned(base: BaseState): number {
  const counts = albumCounts(content, base);
  return counts.survivors.owned + counts.gear.owned;
}

/** Whether the Album has joined the dock: a drop was ever earned, held or opened (D260). */
export function albumShown(base: BaseState): boolean {
  return (
    base.meta.stats.drops > 0 ||
    heldDrops(base.meta.drops) > 0 ||
    cardsOwned(base) > 0 ||
    base.meta.drops.owed.earned > 0
  );
}

/** The head's sub line: "9 of 44 cards". */
export function albumSummary(base: BaseState): string {
  const counts = albumCounts(content, base);
  return t("album.summary", {
    owned: counts.survivors.owned + counts.gear.owned,
    total: counts.survivors.total + counts.gear.total,
  });
}

export function AlbumPanel({ base }: { base: BaseState }) {
  const tab = useUi((state) => state.albumTab);
  const setTab = useUi((state) => state.setAlbumTab);
  const owned = cardsOwned(base);
  useEffect(() => {
    useUi.getState().seeAlbum(owned);
  }, [owned]);
  const held = heldDrops(base.meta.drops);
  const onWay = dropsOnWay(content, base);
  return (
    <div className="album">
      <fieldset className="segments album-tabs">
        <legend className="sr-only">{t("album.title")}</legend>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            className={`segment${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(`album.${id}`)}
          </button>
        ))}
      </fieldset>
      {held > 0 ? (
        <button
          type="button"
          className="album-held plate"
          onClick={() => useReveal.getState().start()}
        >
          <Icon kind="flotsam" id="sealed_locker" size={28} />
          <span className="album-held-text">
            <span key={`held-${held}`} className="album-held-count num pop">
              {t("album.held", { n: held })}
            </span>
            <span className="album-held-sub">
              {([3, 2, 1] as const)
                .filter((tier) => base.meta.drops.held[tier] > 0)
                .map((tier) => `${base.meta.drops.held[tier]}× ${t(`drop.tier_${tier}`)}`)
                .join(" · ")}
            </span>
          </span>
          <span className="btn small">{t("album.open")}</span>
        </button>
      ) : null}
      {onWay > 0 ? (
        <p className="album-onway plate">
          <OnWay base={base} />
        </p>
      ) : null}
      {tab === "crew" ? <CrewTab base={base} /> : null}
      {tab === "gear" ? <GearTab base={base} /> : null}
      {tab === "odds" ? <OddsTab base={base} /> : null}
    </div>
  );
}

function CrewTab({ base }: { base: BaseState }) {
  const openSurvivor = useUi((state) => state.openSurvivor);
  const cards = base.meta.cards;
  return (
    <>
      <ul className="album-grid crew">
        {content.cards.survivors.map((survivor) => {
          const stars = cards.survivors[survivor.id];
          const owned = stars !== undefined;
          const line = content.lines.find((row) => row.hand === survivor.id);
          const onShift = line !== undefined && base.run.hands.includes(line.id);
          return (
            <li key={survivor.id}>
              <button
                type="button"
                className={`card-tile${owned ? " owned" : " missing"}${onShift ? " on-shift" : ""}`}
                style={rarityStyle(survivor.rarity)}
                aria-label={`${crewName(survivor.id)} · ${rarityName(survivor.rarity)}${owned ? ` · ${t("album.stars", { n: stars, max: 5 })}` : ` · ${t("album.not_owned")}`}`}
                onClick={() => openSurvivor(survivor.id)}
              >
                <Bust id={survivor.id} box={48} dim={!owned} />
                <span className="card-tile-name">{crewName(survivor.id)}</span>
                <Stars stars={stars ?? 0} size={11} />
                {onShift ? <span className="card-tile-dot" title={t("album.on_shift")} /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <h3 className="sub-title">
        <span>{t("album.sets")}</span>
      </h3>
      <ul className="album-sets">
        {content.cards.sets.crews.map((set) => {
          const progress = setProgress(content, cards, set);
          const done = setComplete(content, cards, set);
          return (
            <li key={set.id} className={`album-set${done ? " done" : ""}`}>
              <span className="album-set-text">
                <span className="album-set-name">{t(`set.${set.id}.name`)}</span>
                <span className="album-set-effect">
                  {set.effects.map((effect) => setEffectLine(effect)).join(" · ")}
                </span>
              </span>
              <span className="album-set-progress">
                <span className="badge-bar">
                  <span
                    className="badge-fill"
                    style={{ transform: `scaleX(${progress.done / progress.total})` }}
                  />
                </span>
                <span className="num">
                  {done
                    ? t("album.set_done")
                    : set.stars > 1
                      ? t("album.set_progress", { ...progress, stars: set.stars })
                      : t("album.set_owned", progress)}
                </span>
              </span>
            </li>
          );
        })}
        <li className="album-set">
          <span className="album-set-text">
            <span className="album-set-name">{t(`set.${content.cards.sets.kit.id}.name`)}</span>
            <span className="album-set-effect">{t("album.set_kit")}</span>
          </span>
          <span className="album-set-progress">
            <span className="num">
              {t("card_stat.own_line", {
                factor: fmtFactor(content.cards.sets.kit.effect.value),
              })}
            </span>
          </span>
        </li>
      </ul>
    </>
  );
}

function GearTab({ base }: { base: BaseState }) {
  const openGear = useUi((state) => state.openGear);
  const cards = base.meta.cards;
  return (
    <>
      {SLOTS.map((slot) => {
        const rows = content.cards.gear.filter((row) => row.slot === slot);
        const owned = rows.filter((row) => row.id in cards.gear).length;
        return (
          <section key={slot} className="album-slot">
            <h3 className="sub-title">
              <span>
                <Icon kind="ui" id={`slot_${slot}`} size={16} /> {slotName(slot)}
              </span>
              <span className="sub-count">
                {t("logbook.chapter_count", { got: owned, total: rows.length })}
              </span>
            </h3>
            <ul className="album-grid gear">
              {rows.map((gear) => (
                <GearTile key={gear.id} gear={gear} base={base} onOpen={() => openGear(gear.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function GearTile({ gear, base, onOpen }: { gear: GearDef; base: BaseState; onOpen: () => void }) {
  const wearer = base.meta.cards.gear[gear.id];
  const owned = gear.id in base.meta.cards.gear;
  const worn = wearer ? survivorOf(content, wearer) : undefined;
  return (
    <li>
      <button
        type="button"
        className={`card-tile${owned ? " owned" : " missing"}`}
        style={rarityStyle(gear.rarity)}
        aria-label={`${t(`gear.${gear.id}.name`)} · ${rarityName(gear.rarity)}${owned ? "" : ` · ${t("album.not_owned")}`}`}
        onClick={onOpen}
      >
        <GearArt def={gear} box={40} dim={!owned} />
        <span className="card-tile-name">{t(`gear.${gear.id}.name`)}</span>
        {worn ? (
          <span
            className="card-tile-wearer"
            title={t("survivor.worn_by", { name: crewName(worn.id) })}
          >
            <Bust id={worn.id} box={18} />
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** One rarity's shard count; the number pops when it rises (12-feel.md 3.2, D267). */
function ShardChip({ rarity, count }: { rarity: Rarity; count: number }) {
  const rose = useRise(count);
  return (
    <li className="shard-chip" style={rarityStyle(rarity)}>
      <Icon kind="ui" id="shard" size={16} />
      <span key={`n-${rose}`} className={`num${rose > 0 ? " pop" : ""}`}>
        {count}
      </span>
      <span className="shard-chip-name">{rarityName(rarity)}</span>
    </li>
  );
}

function OddsTab({ base }: { base: BaseState }) {
  const openSheet = useUi((state) => state.openSheet);
  const drops = base.meta.drops;
  const first = survivorOf(content, content.cards.drops.first);
  return (
    <div className="album-odds">
      <h3 className="sub-title">
        <span>{t("album.shards_title")}</span>
      </h3>
      <ul className="shard-chips">
        {RARITIES.map((rarity) => (
          <ShardChip key={rarity} rarity={rarity} count={drops.shards.gear[rarity]} />
        ))}
      </ul>
      <p className="goal-note">
        <span>{t("album.shards_how")}</span>
      </p>
      <h3 className="sub-title">
        <span>{t("album.odds_title")}</span>
      </h3>
      <table className="odds-table">
        <thead>
          <tr>
            <th>{t("album.odds_tier")}</th>
            {RARITIES.map((rarity) => (
              <th key={rarity} style={rarityStyle(rarity)}>
                <span className="odds-rarity">{rarityName(rarity)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DROP_TIERS.map((n) => (
            <tr key={n}>
              <th>{t(`drop.tier_${n}`)}</th>
              {RARITIES.map((rarity) => (
                <td key={rarity} className="num">
                  {pct(content.cards.drops.tiers[n - 1]?.odds[rarity] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="sub-title">
        <span>{t("album.pity_title")}</span>
      </h3>
      <ul className="pity-list">
        {pityView(content, drops).map((row) => (
          <li key={row.rarity} className="pity-row" style={rarityStyle(row.rarity)}>
            <span className="pity-text">
              {row.rarity === "legendary"
                ? t("album.pity_legendary_row", { within: row.within })
                : t("album.pity_row", { rarity: rarityName(row.rarity), within: row.within })}
            </span>
            <span className="badge-bar">
              <span
                className="badge-fill"
                style={{ transform: `scaleX(${Math.min(1, row.since / row.within)})` }}
              />
            </span>
            <span className="num pity-count">{t("album.pity_since", row)}</span>
          </li>
        ))}
      </ul>
      <p className="goal-note">
        <span className="goal-note-icon">
          <Icon kind="flotsam" id="sealed_locker" size={16} />
        </span>
        <span>
          {t("album.gate_rule", {
            every: content.cards.drops.fells.every,
            gap: duration(content.cards.drops.fells.gapMinutes * 60),
            perDay: content.cards.drops.fells.perDay,
          })}
        </span>
      </p>
      {first ? (
        <p className="goal-note">
          <span>{t("album.first_card", { name: crewName(first.id) })}</span>
        </p>
      ) : null}
      <button type="button" className="btn ghost fold" onClick={() => openSheet("odds")}>
        {t("album.more_odds")}
        <Icon kind="ui" id="chevron" size={16} />
      </button>
    </div>
  );
}

/** A crew set's effect in one line: an era's lines, Morale, or the Workshop's words. */
function setEffectLine(effect: Effect): string {
  if (effect.stat === "morale") return t("card_stat.morale", { factor: fmtFactor(effect.value) });
  if (effect.op === "more" && effect.scope && TIERS.includes(effect.scope as Tier))
    return t("card_stat.era_more", {
      era: tierName(effect.scope),
      factor: fmtFactor(effect.value),
    });
  return researchEffect(effect);
}

/** "4.5%" with no trailing zeros. */
const pct = (value: number): string => `${Number(value.toPrecision(3))}%`;

export type { Rarity, SurvivorDef };
export { vars };
