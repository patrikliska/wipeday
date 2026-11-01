import { agendaAt, nextAgendaAt } from "@wipe-day/content/blastmap";
import { afloat } from "@wipe-day/domain/flotsam";
import { bigRedGlance } from "@wipe-day/domain/glance";
import { lineOf } from "@wipe-day/domain/lines";
import { keptHands, lifetimeFor } from "@wipe-day/domain/prestige";
import type { BaseState } from "@wipe-day/domain/state";
import { useEffect, useRef } from "react";
import { haptics } from "../sound/audio";
import { useAdvisor } from "../state/advisor";
import { holdProgress, useBigRed } from "../state/bigred";
import { wall } from "../state/clocks";
import { useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { buffName, content, crewName, duration, fmt, fmtFactor, t, tierName } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { PixelArt } from "./PixelArt";

/*
 * The Big Red on screen (docs/redesign/03-the-big-red.md 4-6; 08-screens.md 2.4-2.5; D270):
 * the chip (phone: above the drawer on the left; desktop: the top of the column) from the
 * Kettle's pad on, breathing when crowned; its card: taped shut with the yield bar while
 * nothing can launch, else the cover (the gain, Glow before and after, what this press
 * unlocks, counted or a small blast, KEPT and LOST, the notes, the crew's one-liner) and the
 * hold (the dome, its hazard ring filling over 2 s of real time, let go to cancel). Danger
 * style only, never orange (6.3 rule 1's destructive exception).
 */

/** The hazard tape round the dome: its ring's radius in the 120 px dome's SVG. */
const RING_R = 54;
const RING_LEN = 2 * Math.PI * RING_R;

const islandName = (): string => t("island.saltmarsh.name");

/** Glass an hour (03 2.1): one decimal under 10, else the shared formatter. */
const perHour = (value: number): string =>
  value < 10 ? (Math.round(value * 10) / 10).toString() : fmt(value, "cost");

/** The glance at this second, crowned by the advisor's pick. */
function useGlance(): {
  base: BaseState;
  now: number;
  glance: ReturnType<typeof bigRedGlance>;
  crowned: boolean;
} | null {
  const view = useAdvisor((state) => state.view);
  if (!view) return null;
  const crowned = view.pick.kind === "nuke";
  return {
    base: view.base,
    now: view.now,
    glance: bigRedGlance(content, view.base, view.now, crowned),
    crowned,
  };
}

/** The chip: the Big Red's readout, one tap from its card. Shown from the Kettle's pad on. */
export function BigRedChip() {
  const state = useGlance();
  const phase = useBigRed((s) => s.phase);
  const openCard = useBigRed((s) => s.openCard);
  const column = useColumn();
  // The phone's expanded drawer covers the chip's spot: it steps aside (the column keeps its own).
  const expanded = useUi((s) => s.expanded);
  if (!state || phase !== "idle" || (expanded && !column)) return null;
  const { glance, crowned } = state;
  if (glance.stage === "hidden") return null;
  const locked = !glance.pressable;
  const gainText = locked
    ? t("big_red.chip_locked", { have: Math.floor(glance.exact), need: glance.threshold })
    : t("big_red.chip_gain", { gain: fmt(glance.gain, "cost") });
  const rateText = locked
    ? ""
    : t("big_red.chip_rate", { now: perHour(glance.rateNow), peak: perHour(glance.peak) });
  const fill = locked ? Math.min(1, glance.exact / glance.threshold) : 1;
  return (
    <button
      type="button"
      className={`bigred-chip${crowned ? " crowned" : ""}${locked ? " locked" : ""}${column ? " in-column" : ""}`}
      data-crown={crowned ? "" : undefined}
      onClick={openCard}
      aria-label={t("big_red.chip_label", {
        gain: gainText,
        rate: rateText || t("big_red.locked_title"),
      })}
    >
      <span className="bigred-chip-face">
        <Icon kind="ui" id="big_red" size={26} className="bigred-chip-icon" />
        <span className="bigred-chip-text">
          <span className="bigred-chip-gain num">
            {crowned ? <Icon kind="ui" id="crown" size={14} className="bigred-chip-crown" /> : null}
            {gainText}
          </span>
          {locked ? (
            <span className="bigred-chip-bar" aria-hidden="true">
              <i style={{ transform: `scaleX(${Math.max(0.03, fill)})` }} />
            </span>
          ) : (
            <span className="bigred-chip-rate num">{rateText}</span>
          )}
        </span>
      </span>
    </button>
  );
}

/** KEPT and LOST (03 11, shipped rows only). */
function keptAndLost(base: BaseState): { kept: string[]; lost: string[] } {
  const kept: string[] = [t("big_red.kept_glass")];
  if (base.meta.nodes.length > 0) kept.push(t("big_red.kept_nodes", { n: base.meta.nodes.length }));
  const keptIds = keptHands(content, base);
  if (keptIds.length > 0) {
    const names = keptIds.map((id) => crewName(lineOf(content, id)?.hand ?? id));
    kept.push(
      t("big_red.kept_hands", {
        names: names.length <= 3 ? names.join(", ") : `${names.length} hands`,
      }),
    );
  }
  kept.push(t("big_red.kept_records"));
  const cards =
    Object.keys(base.meta.cards.survivors).length + Object.keys(base.meta.cards.gear).length;
  if (cards > 0 || base.meta.scrap > 0) kept.push(t("big_red.kept_album"));
  const lost: string[] = [];
  const units = Object.values(base.run.lines).reduce((sum, n) => sum + n, 0);
  if (base.run.supplies >= 1)
    lost.push(t("big_red.lost_supplies", { amount: fmt(base.run.supplies, "held") }));
  if (units > 0) lost.push(t("big_red.lost_units", { n: fmt(units, "cost") }));
  if (base.run.upgrades.length > 0)
    lost.push(t("big_red.lost_upgrades", { n: base.run.upgrades.length }));
  if (base.run.era !== "twig") lost.push(t("big_red.lost_era", { era: tierName(base.run.era) }));
  const lostHands = base.run.hands.length - keptIds.length;
  if (lostHands === 1) lost.push(t("big_red.lost_hands_one"));
  else if (lostHands > 1) lost.push(t("big_red.lost_hands", { n: lostHands }));
  return { kept, lost };
}

/** The notes that apply (03 5.2): a buff ending, the airdrop floating by. */
function notes(base: BaseState, now: number): string[] {
  const out: string[] = [];
  for (const buff of base.run.buffs)
    if (buff.until > now)
      out.push(
        t("big_red.note_buff", { buff: buffName(buff.kind), time: duration(buff.until - now) }),
      );
  const drop = afloat(content, base, now);
  if (drop) {
    const id = typeof drop.kind === "string" ? drop.kind : drop.kind.id;
    out.push(t("big_red.note_flotsam", { flotsam: t(`flotsam.${id}.name`) }));
  }
  return out;
}

/** What Wipe Day `n` unlocks, in words. */
function unlocksLine(n: number): string {
  const items = agendaAt(content, n).map(([kind, id]) => t(`agenda.${kind}.${id}`));
  if (items.length > 0) return t("big_red.unlocks", { n, items: items.join(", ") });
  const next = nextAgendaAt(content, n);
  if (next === null) return "";
  const later = agendaAt(content, next).map(([kind, id]) => t(`agenda.${kind}.${id}`));
  return t("big_red.unlocks_later", { m: next, items: later.join(", ") });
}

/** The Big Red's card: taped shut, the cover, or the hold. */
export function BigRedSheet() {
  const open = useUi((state) => state.sheet === "big_red");
  const close = () => useUi.getState().openSheet(null);
  const state = useGlance();
  const holding = useBigRed((s) => s.lidOpen);
  const flipLid = useBigRed((s) => s.flipLid);
  if (!open || !state) return null;
  const { base, now, glance, crowned } = state;
  if (!glance.pressable) return <LockedCard base={base} glance={glance} onClose={close} />;
  return (
    <div className="sheet-backdrop">
      <button
        type="button"
        className="backdrop-hit"
        tabIndex={-1}
        aria-label={t("big_red.not_yet")}
        onClick={close}
      />
      <section
        className={`plate sheet bigred-sheet${holding ? " holding" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bigred-title"
      >
        <header className="panel-head bigred-head">
          <div>
            <h2 id="bigred-title">{t("big_red.title")}</h2>
            <p className="sub">
              {glance.counts
                ? t("big_red.sub", { n: base.meta.wipeDays + 1, island: islandName() })
                : t("big_red.sub_small", { island: islandName() })}
            </p>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={close}
            aria-label={t("big_red.not_yet")}
          >
            <Icon kind="ui" id="close" size={18} />
          </button>
        </header>
        {holding ? (
          <HoldView base={base} glance={glance} onClose={close} />
        ) : (
          <CoverView
            base={base}
            now={now}
            glance={glance}
            crowned={crowned}
            onFlip={flipLid}
            onClose={close}
          />
        )}
      </section>
    </div>
  );
}

function LockedCard({
  base,
  glance,
  onClose,
}: {
  base: BaseState;
  glance: ReturnType<typeof bigRedGlance>;
  onClose: () => void;
}) {
  const first = base.meta.wipeDays === 0;
  const lifetime = base.meta.lifetime + base.run.made;
  const fill = Math.min(1, glance.exact / glance.threshold);
  // Run 1 names the first launch's threshold (50B made); later runs the next whole glass.
  const comesAt = first ? lifetimeFor(content, glance.threshold) : glance.nextAt;
  const quip = useBigRed((s) => s.quip);
  return (
    <div className="sheet-backdrop">
      <button
        type="button"
        className="backdrop-hit"
        tabIndex={-1}
        aria-label={t("settings.close")}
        onClick={onClose}
      />
      <section
        className="plate sheet bigred-sheet locked"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bigred-title"
      >
        <header className="panel-head">
          <div>
            <h2 id="bigred-title">{t("big_red.locked_title")}</h2>
          </div>
          <button
            type="button"
            className="btn icon-btn"
            onClick={onClose}
            aria-label={t("settings.close")}
          >
            <Icon kind="ui" id="close" size={18} />
          </button>
        </header>
        <div className="panel-scroll">
          <div className="bigred-locked-art">
            <PixelArt
              id={`prop/kettle_${glance.stage === "hidden" ? "pad" : glance.stage}`}
              box={96}
              fallback={
                <Icon
                  kind="ui"
                  id={`kettle_${glance.stage === "hidden" ? "pad" : glance.stage}`}
                  size={64}
                />
              }
            />
          </div>
          <p className="bigred-locked-text">
            {first
              ? t("big_red.locked_first", {
                  need: glance.threshold,
                  have: Math.floor(glance.exact),
                  at: fmt(comesAt, "cost"),
                  now: fmt(lifetime, "cost"),
                })
              : t("big_red.locked_later", {
                  at: fmt(comesAt, "cost"),
                  now: fmt(lifetime, "cost"),
                })}
          </p>
          <div className="bigred-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.max(0.02, fill)})` }} />
          </div>
          <p className="bigred-bar-label num">
            {t("big_red.locked_bar", { have: Math.floor(glance.exact), need: glance.threshold })}
          </p>
          {quip ? (
            <p className="bigred-quip">{t("big_red.locked_quip", { name: crewName(quip.crew) })}</p>
          ) : null}
        </div>
        <footer className="panel-foot">
          <button type="button" className="btn primary grow" onClick={onClose}>
            {t("big_red.back_to_work")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function CoverView({
  base,
  now,
  glance,
  crowned,
  onFlip,
  onClose,
}: {
  base: BaseState;
  now: number;
  glance: ReturnType<typeof bigRedGlance>;
  crowned: boolean;
  onFlip: () => void;
  onClose: () => void;
}) {
  const quip = useBigRed((s) => s.quip);
  const relief = useBigRed((s) => s.relief);
  const { kept, lost } = keptAndLost(base);
  const n = base.meta.wipeDays + 1;
  const pct = glance.everBefore > 0 ? Math.round((glance.gain / glance.everBefore) * 100) : 0;
  const lines = notes(base, now);
  return (
    <>
      <div className="panel-scroll bigred-cover">
        <p className="bigred-caps">{t("big_red.gain_caps")}</p>
        <p className="bigred-gain num">
          <ResourceIcon id="glass" size={30} />
          {t("big_red.gain", { gain: fmt(glance.gain, "cost") })}
        </p>
        <p className="bigred-glow num">
          {t("big_red.glow", {
            before: fmtFactor(glance.glowBefore),
            after: fmtFactor(glance.glowAfter),
          })}
        </p>
        <p className="bigred-readout num">
          {t("big_red.readout", {
            gain: fmt(glance.gain, "cost"),
            now: perHour(glance.rateNow),
            peak: perHour(glance.peak),
          })}
        </p>
        {glance.counts ? (
          <>
            <p className="bigred-unlocks">{unlocksLine(n)}</p>
            <p className="bigred-counts">{t("big_red.counts", { n })}</p>
            {!crowned && !glance.doubling ? (
              <p className="bigred-wait">
                {t("big_red.wait", {
                  need: fmt(Math.max(glance.everBefore, glance.threshold), "cost"),
                })}
              </p>
            ) : null}
          </>
        ) : (
          <p className="bigred-small">
            {t("big_red.small", {
              gain: fmt(glance.gain, "cost"),
              pct,
              ever: fmt(glance.everBefore, "cost"),
              n,
              need: fmt(glance.threshold, "cost"),
            })}
          </p>
        )}
        {glance.first ? <p className="bigred-first">{t("big_red.first")}</p> : null}
        <div className="bigred-columns">
          <div>
            <p className="bigred-caps">{t("big_red.kept")}</p>
            <ul>
              {kept.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="bigred-caps">{t("big_red.lost")}</p>
            <ul className="lost">
              {lost.map((row) => (
                <li key={row}>
                  <span className="minus" aria-hidden="true">
                    −
                  </span>
                  {row}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {lines.length > 0 ? (
          <ul className="bigred-notes">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {quip ? (
          <p className="bigred-quip">
            {t(quip.key)} {crewName(quip.crew)}
          </p>
        ) : null}
        {relief ? (
          <p className="bigred-relief" role="status">
            {t(relief)}
          </p>
        ) : null}
      </div>
      <footer className="panel-foot bigred-foot">
        {/* First focus on Not yet (03 5.5): the safe way out is the default. */}
        {/* biome-ignore lint/a11y/noAutofocus: the dialog's first focus belongs on the safe button */}
        <button type="button" className="btn secondary grow" onClick={onClose} autoFocus>
          {t("big_red.not_yet")}
        </button>
        <button type="button" className="btn danger grow" onClick={onFlip}>
          {t("big_red.flip")}
        </button>
      </footer>
    </>
  );
}

/** The hold (03 6; 08 2.5): the dome, the ring filling over 2 s, let go to cancel. */
function HoldView({
  base,
  glance,
  onClose,
}: {
  base: BaseState;
  glance: ReturnType<typeof bigRedGlance>;
  onClose: () => void;
}) {
  const quip = useBigRed((s) => s.quip);
  const relief = useBigRed((s) => s.relief);
  const holding = useBigRed((s) => s.holdSince !== null);
  const armedUntil = useBigRed((s) => s.armedUntil);
  const holdTwice = useUi((s) => s.holdTwice);
  const ring = useRef<SVGCircleElement>(null);
  const dome = useRef<HTMLButtonElement>(null);
  // Re-rendered once a second, so an arming that lapsed shows as such.
  useWorld((s) => s.second);
  const armed = armedUntil !== null && armedUntil > wall.nowMs();

  // The ring and the edge pulse follow the hold on the wall clock, outside React.
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const state = useBigRed.getState();
      const p = holdProgress(state, wall.nowMs());
      if (ring.current) ring.current.style.strokeDashoffset = String(RING_LEN * (1 - p));
      document.documentElement.style.setProperty("--hold", p.toFixed(3));
      if (state.holdSince !== null && p >= 1) state.completeHold();
      if (state.armedUntil !== null && wall.nowMs() > state.armedUntil)
        useBigRed.setState({ armedUntil: null });
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.setProperty("--hold", "0");
    };
  }, []);

  const down = () => {
    if (holdTwice) {
      useBigRed.getState().tapTwice();
      return;
    }
    useBigRed.getState().startHold();
    haptics.buzz([20, 180, 30, 150, 40, 120, 50, 90, 60, 60, 80, 40]);
  };
  const up = () => {
    if (holdTwice) return;
    const state = useBigRed.getState();
    if (state.holdSince !== null && holdProgress(state, wall.nowMs()) < 1) state.cancelHold();
  };
  const helper = holdTwice
    ? armed
      ? t("big_red.armed")
      : t("big_red.arm_helper")
    : t("big_red.hold_helper");
  const label = holdTwice ? (armed ? t("big_red.armed") : t("big_red.arm")) : t("big_red.hold");
  return (
    <>
      <div className="panel-scroll bigred-hold">
        <p className="bigred-gain-line num">
          <ResourceIcon id="glass" size={20} />
          {t("big_red.gain", { gain: fmt(glance.gain, "cost") })} ·{" "}
          {t("big_red.glow", {
            before: fmtFactor(glance.glowBefore),
            after: fmtFactor(glance.glowAfter),
          })}
        </p>
        {quip ? (
          <p className="bigred-quip">
            {t(quip.key)} {crewName(quip.crew)}
          </p>
        ) : null}
        <div className="bigred-dome-wrap">
          <button
            ref={dome}
            type="button"
            className={`bigred-dome${holding || armed ? " down" : ""}`}
            aria-label={label}
            onPointerDown={(event) => {
              if (event.button !== 0 && event.pointerType === "mouse") return;
              event.preventDefault();
              dome.current?.setPointerCapture?.(event.pointerId);
              down();
            }}
            onPointerUp={up}
            onPointerCancel={up}
            onLostPointerCapture={up}
            onKeyDown={(event) => {
              if (event.key !== " " && event.key !== "Enter") return;
              event.preventDefault();
              if (event.repeat) return;
              down();
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") up();
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <svg className="bigred-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="track" cx="60" cy="60" r={RING_R} />
              <circle
                ref={ring}
                className="fill"
                cx="60"
                cy="60"
                r={RING_R}
                strokeDasharray={RING_LEN}
                strokeDashoffset={RING_LEN}
              />
            </svg>
            <span className="bigred-dome-face">
              <Icon kind="ui" id="big_red" size={56} />
            </span>
          </button>
        </div>
        <p className="bigred-hold-label">{label}</p>
        <p className="bigred-hold-helper">{helper}</p>
        {relief ? (
          <p className="bigred-relief" role="status">
            {t(relief)}
          </p>
        ) : null}
        <p className="bigred-run num">
          {t("big_red.sub", {
            n: base.meta.wipeDays + (glance.counts ? 1 : 0),
            island: islandName(),
          })}
        </p>
      </div>
      <footer className="panel-foot bigred-foot">
        <button type="button" className="btn secondary grow" onClick={onClose}>
          {t("big_red.not_yet")}
        </button>
      </footer>
      <div className="hold-pulse" aria-hidden="true" />
    </>
  );
}
