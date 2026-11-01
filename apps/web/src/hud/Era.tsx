import { suppliesAt } from "@wipe-day/domain/settle";
import { useEffect, useRef } from "react";
import { useAdvisor } from "../state/advisor";
import { wall } from "../state/clocks";
import { useColumn } from "../state/layout";
import { counterHold, gameSeconds, useWorld } from "../state/store";
import { useUi } from "../state/ui";
import { content, fmt, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { PixelArt } from "./PixelArt";
import { eraPlate, type EraPlate as Plate } from "./rows";
import { SheetFrame } from "./Sheet";
import { shopOpen } from "./Shop";
import { tierVar, useRise, vars } from "./util";

/**
 * The next era, as plain data, or null (no next era, or its gate shut: D140). The plate shows
 * from the shop's first card, as the era's card did (6.3 rule 6).
 */
function usePlate(): Plate | null {
  const view = useAdvisor((state) => state.view);
  return view && shopOpen(view) ? eraPlate(view) : null;
}

/**
 * The era plate (D245): the next era in the top bar, centred on desktop and beside the lamp on a
 * phone. Saving, it shows the era, "in 3h 12m" and a bar in its colour along its foot, filling
 * each second; affordable, "Build" and the price. It never buys: it opens the era's sheet, where
 * the cost and what it brings come before the commitment (CLAUDE.md 6.3 rule 4). Its face is
 * orange only while eras are new to the player (D244). A new era's plate drops in; reaching the
 * price flashes it.
 */
export function EraPlate() {
  const plate = usePlate();
  const column = useColumn();
  const openSheet = useUi((state) => state.openSheet);
  // The plate arrives when the era changes under it, not when the page loads.
  const shown = useRef<string | null>(null);
  const arrived = useRef(false);
  const era = plate?.era ?? null;
  if (era !== shown.current) {
    arrived.current = shown.current !== null && era !== null;
    shown.current = era;
  }
  const ready = useRise(plate?.ready ? 1 : 0);
  if (!plate) return null;
  const classes = [
    "era-plate",
    plate.gate ? "locked" : plate.ready ? "ready" : "saving",
    arrived.current ? "arrive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      key={plate.era}
      type="button"
      className={classes}
      style={vars({ "--tier-color": tierVar(plate.era) })}
      onClick={() => openSheet("era")}
      aria-label={plate.label}
    >
      <span className={`plate era-face${plate.crowned ? " primary" : ""}`}>
        {ready > 0 ? (
          <span key={`flash-${ready}`} className="card-flash" aria-hidden="true" />
        ) : null}
        <Icon kind="tier" id={plate.era} size={column ? 26 : 18} className="era-icon" />
        <span className="era-text">
          <span className="era-name">{column ? plate.name : plate.short}</span>
          {plate.gate ? (
            // Armored waits for a Wipe Day count (D140): the real reason, in the plate.
            <span className="era-eta era-gate">
              <Icon kind="ui" id="lock" size={12} />
              {t("era_plate.locked", { count: plate.gate.at, toGo: plate.gate.toGo })}
            </span>
          ) : plate.ready ? (
            <span className="era-build">
              <span className="era-build-word">{t("era_plate.build")}</span>
              <span className="num">{plate.price}</span>
            </span>
          ) : (
            <span className="era-eta num">{plate.eta}</span>
          )}
        </span>
        {plate.ready || plate.gate ? null : <EraBar progress={plate.progress} />}
      </span>
    </button>
  );
}

/** The bar along the plate's foot, like a buff's: a sliver shows even at the start. */
function EraBar({ progress }: { progress: number }) {
  return (
    <span className="era-bar" aria-hidden="true">
      <i className="era-fill" style={{ transform: `scaleX(${Math.max(0.03, progress)})` }} />
    </span>
  );
}

/**
 * The era's sheet (D245): the price, what is held and what is left after (or still needed, and
 * when at this pace), then what the era brings (the lines it opens, everything ×2, the new
 * target, the house, the Workshop items), and Build. Build stays visible while saving, disabled with how much is missing
 * (6.3 rule 3); it enables in place when the supplies arrive.
 */
export function EraSheet() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  const plate = usePlate();
  const open = sheet === "era";
  // The era went (bought elsewhere, or the last one): the sheet closes rather than strand the
  // HUD under an empty dialog.
  useEffect(() => {
    if (open && !plate) openSheet(null);
  }, [open, plate, openSheet]);
  if (!open || !plate) return null;
  const close = () => openSheet(null);
  const build = () => {
    if (!plate.ready) return;
    useWorld.getState().send(plate.command);
    close();
  };
  return (
    <SheetFrame
      id="era"
      className="era-sheet"
      title={plate.name}
      head={
        <p className="big num era-cost">
          <ResourceIcon id="supplies" size={24} />
          {plate.price}
        </p>
      }
      primary={
        plate.gate
          ? t("era_sheet.locked", { count: plate.gate.at, toGo: plate.gate.toGo })
          : plate.ready
            ? t("era_sheet.build", { era: plate.name })
            : t("era_sheet.build_need", { need: plate.need ?? "" })
      }
      primaryDisabled={!plate.ready}
      onPrimary={build}
      onClose={close}
    >
      <div className="era-sheet-body" style={vars({ "--tier-color": tierVar(plate.era) })}>
        {/* The figures first: what is held and what is left after, or what is still missing. */}
        <dl className="era-sums">
          <div>
            <dt>{t("era_sheet.have")}</dt>
            <LiveFigure of={(held) => fmt(held, "held")} />
          </div>
          {plate.gate ? (
            <div className="total">
              <dt>{t("era_sheet.opens_when")}</dt>
              <dd className="num">{t("era_sheet.opens_after", { count: plate.gate.at })}</dd>
            </div>
          ) : plate.left !== null ? (
            <div className="total">
              <dt>{t("era_sheet.left")}</dt>
              <LiveFigure of={(held) => fmt(Math.max(0, held - plate.cost), "held")} />
            </div>
          ) : (
            <>
              <div className="total">
                <dt>{t("era_sheet.need")}</dt>
                <LiveFigure of={(held) => fmt(Math.max(0, plate.cost - held), "cost")} />
              </div>
              <div>
                <dt>{t("era_sheet.eta")}</dt>
                <dd className="num">{plate.eta}</dd>
              </div>
            </>
          )}
        </dl>
        <h3 className="era-sheet-title">{t("era_sheet.brings")}</h3>
        <ul className="era-brings">
          <li className="era-opens">
            <span className="era-say">
              <b>{t("era_sheet.opens", { count: plate.lines.length })}</b>
            </span>
            <span className="era-lines">
              {plate.lines.map((line) => (
                <span key={line.id} className="era-line-chip">
                  <PixelArt
                    id={`line/${line.id}_1`}
                    box={32}
                    fallback={<Icon kind="line" id={line.id} size={24} />}
                  />
                  <span>{line.name}</span>
                </span>
              ))}
            </span>
          </li>
          <li>
            <span className="era-glyph factor num">×{plate.factor}</span>
            <span className="era-say">
              <b>{t("era_sheet.everything", { factor: plate.factor })}</b>
              <small className="era-sub">{t("era_sheet.everything_sub")}</small>
            </span>
          </li>
          <li>
            <span className="era-glyph">
              <PixelArt
                id={`target/${plate.target.id}`}
                box={40}
                fallback={<Icon kind="target" id={plate.target.id} size={24} />}
              />
            </span>
            <span className="era-say">
              <b>{t("era_sheet.target", { target: plate.target.name })}</b>
              <small className="era-sub">{t("era_sheet.target_sub")}</small>
            </span>
          </li>
          {plate.house ? (
            <li>
              <span className="era-glyph">
                <PixelArt
                  id={`house/${plate.era}`}
                  box={40}
                  fallback={<Icon kind="tier" id={plate.era} size={24} />}
                />
              </span>
              <span className="era-say">
                <b>{t("era_sheet.house", plate.house)}</b>
              </span>
            </li>
          ) : null}
          {plate.workshop > 0 ? (
            <li>
              <span className="era-glyph">
                <Icon kind="nav" id="workshop" size={24} />
              </span>
              <span className="era-say">
                <b>{t("era_sheet.workshop", { count: plate.workshop })}</b>
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </SheetFrame>
  );
}

/**
 * A figure of the sheet written each frame from the closed-form settle, as the counter is
 * (TopBar), so "You have" never lags the counter above it. React renders the element once.
 */
function LiveFigure({ of }: { of: (held: number) => string }) {
  const ref = useRef<HTMLElement>(null);
  const format = useRef(of);
  format.current = of;
  useEffect(() => {
    let frame = 0;
    let shown = "";
    const draw = () => {
      const base = useWorld.getState().base;
      if (base && ref.current) {
        const now = Math.max(gameSeconds(), base.run.settledAt);
        const held = Math.max(0, suppliesAt(content, base, now) - counterHold(wall.nowMs()));
        const text = format.current(held);
        if (text !== shown) {
          ref.current.textContent = text;
          shown = text;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);
  return <dd className="num" ref={ref} />;
}
