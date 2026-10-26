import type { BoostDef } from "@wipe-day/content/schema";
import { boostUntil } from "@wipe-day/domain/boosts";
import type { BaseState } from "@wipe-day/domain/state";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, duration, t } from "../state/world";
import { send } from "./Goals";
import { Icon, ResourceIcon } from "./Icon";
import { SheetFrame } from "./Sheet";
import { useRise } from "./util";

/*
 * Scrap on screen (12-feel.md 8; D182, D258, D259): a gold chip in the top bar once the player
 * has ever earned any, with the count; it opens the Scrap sheet, where the boosts and the bought
 * Supply Drops show their price, what they do and what is missing (6.3 rules 3 and 4). Nothing
 * here costs money (D182). S3 adds the reveal and the boost pills' polish.
 */

/** The chip: the scrap nut and the count, popping when it rises. Hidden until scrap ever came. */
export function ScrapPlate() {
  const scrap = useWorld((state) => state.base?.meta.scrap ?? 0);
  const ever = useWorld((state) => state.base?.meta.stats.scrap ?? 0);
  const openSheet = useUi((state) => state.openSheet);
  const rose = useRise(scrap);
  if (ever <= 0) return null;
  return (
    <button
      type="button"
      className="scrap-plate"
      onClick={() => openSheet("scrap")}
      aria-label={t("scrap.label", { n: scrap })}
    >
      {/* A 44 px tap target around the 36 px plate, as the era plate does. */}
      <span className="plate scrap-face">
        {rose > 0 ? <span key={`flash-${rose}`} className="card-flash" aria-hidden="true" /> : null}
        <ResourceIcon id="scrap" size={20} className="scrap-plate-icon" />
        <span key={`n-${rose}`} className={`num${rose > 0 ? " pop" : ""}`}>
          {scrap}
        </span>
      </span>
    </button>
  );
}

/** A boost's row: what it does, its price, a Buy that explains itself while it cannot. */
function BoostRow({ boost, base, now }: { boost: BoostDef; base: BaseState; now: number }) {
  const until = boostUntil(base, boost, now);
  const have = base.meta.scrap;
  const short = Math.max(0, boost.cost - have);
  const running = until !== null;
  const left = running ? Math.max(0, until - now) : 0;
  const fill = running ? left / boost.seconds : 0;
  return (
    <li className={`scrap-row${running ? " running" : ""}`} data-key={`boost:${boost.id}`}>
      <span className="goal-icon">
        <Icon kind="ui" id={boost.id} size={26} />
      </span>
      <span className="goal-text">
        <span className="goal-name">{t(`boost.${boost.id}.name`)}</span>
        <span className="goal-progress">
          {running ? (
            <>
              <span className="goal-bar" aria-hidden="true">
                <i className="fill" style={{ transform: `scaleX(${fill})` }} />
              </span>
              <span className="num goal-figure">
                {t("scrap.running", { time: duration(left) })}
              </span>
            </>
          ) : (
            <span>{t(`boost.${boost.id}.sub`)}</span>
          )}
        </span>
      </span>
      <button
        type="button"
        className="btn buy"
        disabled={running || short > 0}
        aria-label={t("scrap.buy_label", { name: t(`boost.${boost.id}.name`), cost: boost.cost })}
        onClick={() => send({ type: "buy_boost", boost: boost.id })}
      >
        <span className="buy-top">
          {running
            ? t("scrap.running_short")
            : short > 0
              ? t("scrap.need", { need: short })
              : t("scrap.buy")}
        </span>
        <span className="buy-cost num scrap-cost">
          <ResourceIcon id="scrap" size={12} />
          {boost.cost}
        </span>
      </button>
    </li>
  );
}

/** A Supply Drop for scrap: tier II or III, three cards for the Album. */
function DropRow({ tier, base }: { tier: 2 | 3; base: BaseState }) {
  const cost = content.scrap.drops[tier];
  const short = Math.max(0, cost - base.meta.scrap);
  return (
    <li className="scrap-row" data-key={`drop:${tier}`}>
      <span className="goal-icon">
        <Icon kind="flotsam" id="sealed_locker" size={26} />
      </span>
      <span className="goal-text">
        <span className="goal-name">{t(`drop.tier_${tier}`)}</span>
        <span className="goal-progress">
          <span>{t("scrap.drop_sub", { cards: content.cards.drops.cards })}</span>
        </span>
      </span>
      <button
        type="button"
        className="btn buy"
        disabled={short > 0}
        aria-label={t("scrap.buy_label", { name: t(`drop.tier_${tier}`), cost })}
        onClick={() => send({ type: "buy_drop", tier })}
      >
        <span className="buy-top">
          {short > 0 ? t("scrap.need", { need: short }) : t("scrap.buy")}
        </span>
        <span className="buy-cost num scrap-cost">
          <ResourceIcon id="scrap" size={12} />
          {cost}
        </span>
      </button>
    </li>
  );
}

/** The Scrap sheet: the count, the boosts, the drops, and where scrap comes from. */
export function ScrapSheet() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const base = useWorld((state) => state.base);
  const second = useWorld((state) => state.second);
  if (sheet !== "scrap" || !base) return null;
  const now = Math.max(second, base.run.settledAt);
  const close = () => openSheet(null);
  return (
    <SheetFrame
      id="scrap"
      className="scrap-sheet"
      title={t("scrap.title")}
      head={
        <p className="big num scrap-held">
          <ResourceIcon id="scrap" size={24} />
          {base.meta.scrap}
        </p>
      }
      primary={t("settings.done")}
      onPrimary={close}
      onClose={close}
    >
      <h3 className="sub-title">
        <span>{t("scrap.boosts")}</span>
      </h3>
      <ul className="goals compact scrap-rows">
        {content.scrap.boosts.map((boost) => (
          <BoostRow key={boost.id} boost={boost} base={base} now={now} />
        ))}
      </ul>
      <h3 className="sub-title">
        <span>{t("scrap.drops")}</span>
      </h3>
      <ul className="goals compact scrap-rows">
        <DropRow tier={2} base={base} />
        <DropRow tier={3} base={base} />
      </ul>
      <p className="goal-note">
        <span className="goal-note-icon">
          <ResourceIcon id="scrap" size={16} />
        </span>
        <span>{t("scrap.earn", { magpie: content.scrap.magpie })}</span>
      </p>
    </SheetFrame>
  );
}
