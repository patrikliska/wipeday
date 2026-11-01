import { agendaAt, nextAgendaAt } from "@wipe-day/content/blastmap";
import { affordableNodes } from "@wipe-day/domain/blastmap";
import type { NukedEvent } from "@wipe-day/domain/events";
import { glassYield } from "@wipe-day/domain/prestige";
import type { BaseState } from "@wipe-day/domain/state";
import { islandHour, weatherAt } from "@wipe-day/domain/weather";
import { useEffect } from "react";
import { paletteAt } from "../scene/palette";
import { postcardSigner, useBigRed } from "../state/bigred";
import { wall } from "../state/clocks";
import { gameSeconds, useWorld } from "../state/store";
import { reducedMotion, useUi } from "../state/ui";
import { content, duration, fmt, fmtFactor, lineName, t, tierName } from "../state/world";
import { Icon } from "./Icon";
import { postcardSvg } from "./postcardSvg";

/*
 * The postcard (docs/redesign/03-the-big-red.md 8; 08-screens.md 2.7; D270): the front is the
 * player's own crater as an SVG from `postcardSvg`; it flips to the back 1.5 s after landing
 * (a cross-fade under reduced motion) and a tap flips it again. The back is the run summary
 * from the `nuked` event and NEXT, what the next Wipe Day unlocks (shipped content only). One
 * button on Wipe Day #1, Open the Blast Map (03 8.4: the landing plays, then the map opens on
 * its disk with the pick pulsing); from #2 Rebuild is the primary and "Blast Map · n
 * affordable" the quiet second way on (D271).
 */

const FLIP_MS = 1500;

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** The front's title (03 8.2). */
function titleFor(
  event: NukedEvent,
  base: BaseState,
  now: number,
): { greeting: string; place: string; whole: string } {
  const small = event.wipeDay === null;
  const fraction = islandHour(content, now) / 24;
  const night = fraction < 0.22 || fraction > 0.8;
  const weather = weatherAt(content, now);
  let whole: string;
  if (small) whole = t("postcard.title_small");
  else if (event.wipeDay === 1) whole = t("postcard.title_default");
  else if (event.gain >= base.meta.records.bestBlast && event.gain > 0 && event.doubling)
    whole = t("postcard.title_record");
  else if (night) whole = t("postcard.title_night");
  else if (weather !== "clear") whole = t("postcard.title_rain");
  else {
    const pick = 1 + (Math.abs(base.seed + event.n * 7) % 4);
    whole = t(`postcard.pool_${pick}`);
  }
  const prefix = `${t("postcard.greetings")} `;
  return whole.startsWith(prefix)
    ? { greeting: t("postcard.greetings"), place: whole.slice(prefix.length), whole }
    : { greeting: "", place: whole, whole };
}

/** The front's picture for this press, at this moment of the island's day. */
function lookFor(event: NukedEvent, base: BaseState, now: number) {
  const fraction = islandHour(content, now) / 24;
  const palette = paletteAt(fraction);
  const title = titleFor(event, base, now);
  const date = new Date(now * 1000)
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
  return {
    wipeDay: event.wipeDay,
    gain: event.gain,
    flight: event.flight,
    sky: { top: hex(palette.skyTop), mid: hex(palette.skyMid), horizon: hex(palette.skyHorizon) },
    night: fraction < 0.22 || fraction > 0.8,
    greeting: title.greeting,
    place: title.place,
    stamp: t("postcard.stamp", { gain: fmt(event.gain, "cost") }),
    postmark: t("postcard.postmark", { date }),
    seed: (base.seed % 1000) + event.n,
    whole: title.whole,
  };
}

/** NEXT (03 8.3, 12): what the next Wipe Day unlocks, shipped content only. */
function nextLine(event: NukedEvent, base: BaseState, now: number): string {
  if (event.wipeDay === null) {
    const y = glassYield(content, base, now);
    return t("postcard.next_small", { n: base.meta.wipeDays + 1, need: fmt(y.threshold, "cost") });
  }
  const next = nextAgendaAt(content, event.wipeDay);
  if (next === null) return "";
  const items = agendaAt(content, next).map(([kind, id]) => t(`agenda.${kind}.${id}`));
  return t("postcard.next", { n: next, items: items.join(", ") });
}

export function PostcardSheet() {
  const open = useUi((state) => state.sheet === "postcard");
  const postcard = useBigRed((state) => state.postcard);
  const flip = useBigRed((state) => state.flipPostcard);
  const rebuild = useBigRed((state) => state.rebuild);
  const rebuildToMap = useBigRed((state) => state.rebuildToMap);
  const base = useWorld((state) => state.base);
  // It flips to the back 1.5 s after it lands.
  useEffect(() => {
    if (!open || !postcard || postcard.flipped) return;
    const left = Math.max(0, FLIP_MS - (wall.nowMs() - postcard.shownMs));
    const timer = window.setTimeout(() => {
      const state = useBigRed.getState();
      if (state.postcard && !state.postcard.flipped) state.flipPostcard();
    }, left);
    return () => window.clearTimeout(timer);
  }, [open, postcard]);
  if (!open || !postcard || !base) return null;
  const { event } = postcard;
  const now = Math.floor(gameSeconds());
  const look = lookFor(event, base, now);
  const small = event.wipeDay === null;
  const svg = postcardSvg(look);
  const { summary } = event;
  const flightDef = content.prestige.flights.variants.find((row) => row.id === event.flight);
  const newFlight = !small && flightDef?.unlockAt === event.wipeDay;
  const message = 1 + (Math.abs(base.seed + event.n * 3) % 4);
  const rows: Array<[string, string]> = [
    [t("postcard.run_time"), duration(summary.seconds)],
    [
      t("postcard.glass"),
      t("postcard.glass_value", { gain: fmt(event.gain, "cost"), ever: fmt(event.ever, "cost") }),
    ],
    [
      t("postcard.glow"),
      t("postcard.glow_value", {
        before: fmtFactor(event.glowBefore),
        after: fmtFactor(event.glowAfter),
      }),
    ],
    [
      t("postcard.best_line"),
      summary.bestLine
        ? t("postcard.best_line_value", {
            line: lineName(summary.bestLine.id),
            pct: Math.round(summary.bestLine.share * 100),
          })
        : t("postcard.best_line_none"),
    ],
    [t("postcard.flotsam"), String(summary.flotsam)],
    [
      t("postcard.flight"),
      newFlight
        ? t("postcard.flight_new", { flight: t(`flight.${event.flight}`) })
        : t(`flight.${event.flight}`),
    ],
    [t("postcard.era"), tierName(summary.era)],
  ];
  const next = nextLine(event, base, now);
  const firstDay = event.wipeDay === 1;
  const affordable = affordableNodes(content, base.meta).length;
  const mapWords =
    affordable > 0
      ? t("postcard.map_affordable", { n: affordable })
      : t("postcard.map_glass", { glass: fmt(base.meta.glass.held, "held") });
  return (
    <div className="sheet-backdrop">
      <button
        type="button"
        className="backdrop-hit"
        tabIndex={-1}
        aria-label={t("postcard.rebuild")}
        onClick={rebuild}
      />
      <section
        className="plate sheet postcard-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("postcard.title")}
      >
        <div className="panel-scroll postcard-scroll">
          <div
            className={`postcard${postcard.flipped ? " flipped" : ""}${reducedMotion() ? " reduced" : ""}`}
          >
            <button
              type="button"
              className="postcard-flip"
              onClick={flip}
              aria-label={t("postcard.flip")}
            >
              <span className="postcard-front" role="img" aria-label={look.whole}>
                {/* biome-ignore lint/security/noDangerouslySetInnerHtml: our own pure SVG, no user content */}
                <span className="postcard-art" dangerouslySetInnerHTML={{ __html: svg }} />
              </span>
              <span className="postcard-back">
                <span className="postcard-head">
                  {small
                    ? t("postcard.head_small", { island: t("island.saltmarsh.name") })
                    : t("postcard.head", {
                        n: event.wipeDay ?? 0,
                        island: t("island.saltmarsh.name"),
                      })}
                </span>
                <span className="postcard-rows">
                  {rows.map(([label, value]) => (
                    <span key={label} className="postcard-row">
                      <span className="postcard-label">{label}</span>
                      <span className="postcard-value num">{value}</span>
                    </span>
                  ))}
                </span>
                <span className="postcard-message">
                  {t(`postcard.message_${message}`, { name: postcardSigner(base, event) })}
                </span>
                {next ? <span className="postcard-next">{next}</span> : null}
              </span>
            </button>
          </div>
        </div>
        <footer className="panel-foot postcard-foot">
          {firstDay ? (
            <button type="button" className="btn primary grow" onClick={rebuildToMap}>
              <Icon kind="nav" id="blast_map" size={18} />
              <span className="postcard-btn-text">
                {t("postcard.open_map")}
                <small>
                  {t("postcard.open_map_sub", { glass: fmt(base.meta.glass.held, "held") })}
                </small>
              </span>
            </button>
          ) : (
            <>
              <button type="button" className="btn secondary" onClick={rebuildToMap}>
                <Icon kind="nav" id="blast_map" size={18} />
                {mapWords}
              </button>
              <button type="button" className="btn primary grow" onClick={rebuild}>
                <Icon kind="nav" id="island" size={18} />
                {t("postcard.rebuild")}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
