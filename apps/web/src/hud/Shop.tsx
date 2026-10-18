import type { Command } from "@wipe-day/domain/commands";
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type AdvisorView, useAdvisor } from "../state/advisor";
import { insets, useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { BULKS, type Bulk, reducedMotion, type Tab, useUi } from "../state/ui";
import { content, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { PixelArt } from "./PixelArt";
import {
  affordableUpgrades,
  type Bar,
  type Button,
  bulkShown,
  cardCrowned,
  crownPick,
  crownTab,
  linesTab,
  pickPlace,
  type Row,
  upgradesTab,
} from "./rows";
import { Ticker } from "./Ticker";
import { tierVar, vars } from "./util";

/** A drag on the handle longer than this opens or closes the drawer (CSS px). */
const DRAG_PX = 30;
/** The collapsed drawer follows the crown, but never this soon after the player touched it. */
const TOUCH_QUIET_MS = 4000;

const BULK_LABEL: Record<string, string> = {
  "1": "drawer.bulk_one",
  "10": "drawer.bulk_ten",
  "100": "drawer.bulk_hundred",
  max: "drawer.bulk_max",
};

/** The shop appears with its first card: once the first line's price is reached (wireframe 1). */
export function shopOpen(view: AdvisorView | null): boolean {
  if (!view) return false;
  const run = view.base.run;
  const first = Math.min(
    ...content.lines.filter((line) => line.era === "twig").map((line) => line.cost),
  );
  return (
    view.base.meta.nukes > 0 ||
    run.era !== "twig" ||
    Object.values(run.lines).some((n) => n > 0) ||
    run.made >= first
  );
}

const send = (command: Command | null): void => {
  if (command) useWorld.getState().send(command);
};

/**
 * The shop (12-feel.md 4): the desktop column of cards, or the phone drawer. The cards keep one
 * order forever (D186); the crown lights its card where it stands.
 */
export function Shop() {
  const column = useColumn();
  const view = useAdvisor((state) => state.view);
  const open = shopOpen(view);
  useEffect(() => {
    if (!column) insets.right = 0;
  }, [column]);
  useEffect(() => {
    if (!open) useUi.setState({ crownInView: true });
  }, [open]);
  if (!view || !open) return null;
  return column ? <Column view={view} /> : <Drawer view={view} />;
}

/** The bulk size in force: ×1 until the toggle exists. */
function useBulk(view: AdvisorView): Bulk {
  const bulk = useUi((state) => state.bulk);
  return bulkShown(view.base) ? bulk : 1;
}

function tabRows(view: AdvisorView, tab: Tab, bulk: Bulk) {
  if (tab === "lines") return { rows: linesTab(view, bulk), bought: [] };
  return upgradesTab(view);
}

function Drawer({ view }: { view: AdvisorView }) {
  const expanded = useUi((state) => state.expanded);
  const tab = useUi((state) => state.tab);
  const expand = useUi((state) => state.expand);
  const bulk = useBulk(view);
  const list = useRef<HTMLDivElement>(null);
  const touchedAt = useRef(Number.NEGATIVE_INFINITY);
  const drag = useRef<number | null>(null);

  const { rows: plain, bought } = tabRows(view, tab, bulk);
  // Collapsed, the drawer is the island's view (its one crown); expanded, a view of its own.
  const rows = expanded ? crownTab(plain, view) : crownPick(plain, view);
  useCrownFocus(list, view, tab, expanded ? null : touchedAt);

  const onHandleDown = (event: ReactPointerEvent) => {
    drag.current = event.clientY;
  };
  const onHandleUp = (event: ReactPointerEvent) => {
    const start = drag.current;
    drag.current = null;
    if (start === null) return;
    const dy = event.clientY - start;
    if (!expanded && dy < -DRAG_PX) open(true);
    if (expanded && dy > DRAG_PX) open(false);
  };
  const open = (next: boolean) => {
    expand(next);
  };

  return (
    <div
      className={`drawer${expanded ? " expanded" : ""}`}
      onPointerDown={() => {
        touchedAt.current = performance.now();
      }}
      onWheel={() => {
        touchedAt.current = performance.now();
      }}
    >
      <div className="handle" onPointerDown={onHandleDown} onPointerUp={onHandleUp}>
        <span className="grabber" aria-hidden="true" />
        <Ticker />
        <button
          type="button"
          className="btn ghost toggle-drawer"
          aria-expanded={expanded}
          aria-label={expanded ? t("drawer.close") : t("drawer.see_all")}
          onClick={() => open(!expanded)}
        >
          <Icon kind="ui" id="chevron" size={18} className={expanded ? "down" : "up"} />
        </button>
      </div>
      <div className="shop-bar">
        <Tabs view={view} />
        {bulkShown(view.base) && !expanded ? <BulkCycle /> : null}
      </div>
      {expanded && bulkShown(view.base) ? <BulkSegments /> : null}
      <CardList rows={rows} bought={bought} list={list} />
    </div>
  );
}

/** Desktop: a permanent column of cards on the right (12-feel.md 4; 08-screens.md 1.7). */
function Column({ view }: { view: AdvisorView }) {
  const tab = useUi((state) => state.tab);
  const bulk = useBulk(view);
  const ref = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { rows: plain, bought } = tabRows(view, tab, bulk);
  // The column shares the island's view: it lights the island's crown, and none while the crown
  // is on the tap hint (CLAUDE.md 6.3 rule 1).
  const rows = crownPick(plain, view);
  useCrownFocus(list, view, tab, null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const publish = () => {
      insets.right = Math.round(element.getBoundingClientRect().width);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      insets.right = 0;
    };
  }, []);

  return (
    <aside ref={ref} className="column" aria-label={t("drawer.shop")}>
      <div className="shop-bar">
        <Tabs view={view} />
      </div>
      {bulkShown(view.base) ? <BulkSegments /> : null}
      <CardList rows={rows} bought={bought} list={list} />
    </aside>
  );
}

/**
 * Keeps the crown findable without moving a card (D186, D220): reports whether the crowned card
 * is on screen (the Best buy chip shows when it is not), scrolls to it and pulses it once when
 * the chip asks, and, in the collapsed drawer only (`follow`), keeps it in the two-card window
 * unless the player touched the drawer in the last few seconds.
 */
function useCrownFocus(
  list: RefObject<HTMLDivElement | null>,
  view: AdvisorView,
  tab: Tab,
  follow: RefObject<number> | null,
): void {
  const place = pickPlace(view);
  // The island's crowned card, when it is on the tab in sight.
  const crowned = place && place.tab === tab ? place.key : null;
  const offTab = place !== null && place.tab !== tab;
  const focusAt = useUi((state) => state.focusAt);
  const handled = useRef(focusAt);

  useEffect(() => {
    const root = list.current;
    if (!root) return;
    if (!crowned) {
      useUi.setState({ crownInView: !offTab });
      return;
    }
    const card = root.querySelector<HTMLElement>(`[data-key="${crowned}"]`);
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => useUi.setState({ crownInView: (entry?.intersectionRatio ?? 0) >= 0.75 }),
      { root, threshold: [0, 0.75, 1] },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [list, crowned, offTab]);

  // The collapsed drawer's window follows the crown, calmly.
  useEffect(() => {
    const root = list.current;
    if (!root || !crowned || !follow) return;
    if (performance.now() - follow.current < TOUCH_QUIET_MS) return;
    const card = root.querySelector<HTMLElement>(`[data-key="${crowned}"]`);
    if (card) scrollTo(root, card, "nearest");
  }, [list, crowned, follow]);

  // The Best buy chip: scroll to the card and pulse it once.
  useEffect(() => {
    if (focusAt === handled.current) return;
    handled.current = focusAt;
    const root = list.current;
    if (!root || !crowned) return;
    const card = root.querySelector<HTMLElement>(`[data-key="${crowned}"]`);
    if (!card) return;
    scrollTo(root, card, "center");
    card.classList.remove("pulse");
    void card.offsetWidth;
    card.classList.add("pulse");
    window.setTimeout(() => card.classList.remove("pulse"), 900);
  });
}

function scrollTo(root: HTMLElement, card: HTMLElement, mode: "nearest" | "center"): void {
  const top = card.offsetTop;
  const bottom = top + card.offsetHeight;
  let target = root.scrollTop;
  if (mode === "center") target = top - (root.clientHeight - card.offsetHeight) / 2;
  else if (top < root.scrollTop + 6) target = top - 6;
  else if (bottom > root.scrollTop + root.clientHeight - 6) target = bottom - root.clientHeight + 6;
  if (Math.abs(target - root.scrollTop) < 1) return;
  root.scrollTo({ top: target, behavior: reducedMotion() ? "auto" : "smooth" });
}

function Tabs({ view }: { view: AdvisorView }) {
  const tab = useUi((state) => state.tab);
  const setTab = useUi((state) => state.setTab);
  const count = affordableUpgrades(view);
  // The island's crown on the other tab: a small mark on it (not orange: one crown per view).
  const elsewhere = pickPlace(view)?.tab;
  const select = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
  };
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "lines", label: t("drawer.lines"), count: 0 },
    { id: "upgrades", label: t("drawer.upgrades"), count },
  ];
  return (
    <div className="tabs" role="tablist">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={`tab${tab === item.id ? " on" : ""}`}
          onClick={() => select(item.id)}
        >
          {item.label}
          {elsewhere === item.id && tab !== item.id ? (
            <Icon kind="ui" id="crown" size={14} className="tab-crown" />
          ) : null}
          {item.count > 0 ? <span className="count num">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

function CardList({
  rows,
  bought,
  list,
}: {
  rows: Row[];
  bought: Array<{ id: string; name: string }>;
  list: RefObject<HTMLDivElement | null>;
}) {
  const boughtOpen = useUi((state) => state.boughtOpen);
  const toggleBought = useUi((state) => state.toggleBought);
  const tab = useUi((state) => state.tab);
  return (
    <div className="cards" role="tabpanel" ref={list}>
      {rows.length === 0 ? <p className="empty">{t("drawer.empty")}</p> : null}
      {rows.map((row) => (
        <Card key={row.key} row={row} />
      ))}
      {tab === "upgrades" && bought.length > 0 ? (
        <>
          <button
            type="button"
            className="btn ghost fold"
            aria-expanded={boughtOpen}
            onClick={toggleBought}
          >
            {t("drawer.bought", { count: bought.length })}
            <Icon kind="ui" id="chevron" size={16} className={boughtOpen ? "up" : "down"} />
          </button>
          {boughtOpen ? (
            <ul className="bought">
              {bought.map((item) => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** The handle's bulk button: ×1 → ×10 → ×100 → Max (44 × 44). */
function BulkCycle() {
  const bulk = useUi((state) => state.bulk);
  const setBulk = useUi((state) => state.setBulk);
  const next = BULKS[(BULKS.indexOf(bulk) + 1) % BULKS.length] ?? 1;
  return (
    <button
      type="button"
      className="btn bulk-cycle num"
      aria-label={`${t("drawer.bulk")}: ${t(BULK_LABEL[String(bulk)] ?? "")}`}
      onClick={() => setBulk(next)}
    >
      {t(BULK_LABEL[String(bulk)] ?? "")}
    </button>
  );
}

/** The segmented control: ×1 · ×10 · ×100 · Max. */
function BulkSegments() {
  const bulk = useUi((state) => state.bulk);
  const setBulk = useUi((state) => state.setBulk);
  return (
    <fieldset className="segments">
      <legend className="sr-only">{t("drawer.bulk")}</legend>
      {BULKS.map((size) => (
        <button
          key={String(size)}
          type="button"
          aria-pressed={bulk === size}
          className={`segment num${bulk === size ? " on" : ""}`}
          onClick={() => {
            if (bulk === size) return;
            setBulk(size);
          }}
        >
          {t(BULK_LABEL[String(size)] ?? "")}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * One card (12-feel.md 4): the art with its level and its hand, the name, the rate, the bar to
 * the next milestone, and one button; a line without its hand carries the hire as a second,
 * smaller button where the milestone line would be.
 */
export const Card = memo(function Card({ row }: { row: Row }) {
  const column = useColumn();
  const owned = row.owned ?? 0;
  const lineCard = row.kind === "line";
  // A purchase flashes its card and pops its level; a hire pops the hand's face (3.2).
  const bought = useRise(owned + (row.mk ?? 0));
  const hired = useRise(row.hand ? 1 : 0);
  const icon = (
    <Icon kind={row.icon.kind} id={row.icon.id} size={column ? 44 : 38} className="thumb-icon" />
  );
  return (
    <div
      className={`card kind-${row.kind}${row.locked ? " locked" : ""}${cardCrowned(row) ? " crown" : ""}`}
      data-key={row.key}
      style={vars({ "--tier-color": tierVar(row.tier) })}
    >
      {bought + hired > 0 ? (
        <span key={`flash-${bought + hired}`} className="card-flash" aria-hidden="true" />
      ) : null}
      <div className="thumb">
        {row.art ? <PixelArt id={row.art} box={column ? 64 : 52} fallback={icon} /> : icon}
        {lineCard && owned > 0 ? (
          <span key={`lvl-${bought}`} className={`lvl num${bought > 0 ? " pop" : ""}`}>
            {owned}
          </span>
        ) : null}
        {lineCard && owned > 0 ? (
          row.hand ? (
            <span key={`face-${hired}`} className={`face${hired > 0 ? " pop" : ""}`}>
              <Icon kind="crew" id={row.hand} size={16} />
            </span>
          ) : (
            <span className="face finger">
              <Icon kind="ui" id="finger" size={13} />
            </span>
          )
        ) : null}
        {row.mk ? (
          <span key={`mk-${bought}`} className={`mk num${bought > 0 ? " pop" : ""}`}>
            {row.mk === 2 ? "II" : "III"}
          </span>
        ) : null}
        {row.locked ? (
          <span className="lock">
            <Icon kind="ui" id="lock" size={13} />
          </span>
        ) : null}
        {lineCard && owned > 0 && row.bar ? <CycleBar bar={row.bar} /> : null}
      </div>
      <div className="mid">
        <div className="name">{row.name}</div>
        {lineCard && row.product && owned > 0 ? (
          <div className="rate">
            <ResourceIcon id={row.product} size={14} />
            <span className="num">{row.rate}</span>
          </div>
        ) : row.sub ? (
          <div className="sub">{row.sub}</div>
        ) : null}
        {row.progress !== undefined ? (
          <div className="prog" aria-hidden="true">
            <i style={{ transform: `scaleX(${row.progress})` }} />
          </div>
        ) : null}
        {row.hire ? (
          <HireButton hire={row.hire} />
        ) : row.note ? (
          <div className="note">{row.note}</div>
        ) : null}
      </div>
      <BuyButton
        button={row.button}
        crowned={row.crowned}
        command={row.command}
        locked={row.locked}
      />
    </div>
  );
}, sameCard);

/**
 * How many times `value` has risen since the card mounted (0 at first): a new count restarts
 * the card's flash and pop, and a card that mounts with its count shows none.
 */
function useRise(value: number): number {
  const last = useRef(value);
  const [rises, setRises] = useState(0);
  useEffect(() => {
    if (value > last.current) setRises((n) => n + 1);
    last.current = value;
  }, [value]);
  return rises;
}

/** Cards are rebuilt each second: re-render only when something shown changed. */
function sameCard(a: { row: Row }, b: { row: Row }): boolean {
  return JSON.stringify(a.row) === JSON.stringify(b.row);
}

function BuyButton({
  button,
  crowned,
  command,
  locked,
}: {
  button: Button;
  crowned: boolean;
  command: Command | null;
  locked: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn buy${crowned ? " primary crowned" : ""}`}
      disabled={!button.enabled}
      aria-label={crowned ? `${button.label} · ${t("row.crowned")}` : button.label}
      onClick={() => send(command)}
    >
      <span className="buy-top">
        {locked ? <Icon kind="ui" id="lock" size={12} /> : null}
        {button.top}
      </span>
      {button.cost ? <span className="buy-cost num">{button.cost}</span> : null}
    </button>
  );
}

function HireButton({ hire }: { hire: NonNullable<Row["hire"]> }) {
  const { button, crowned } = hire;
  return (
    <button
      type="button"
      className={`btn hire${crowned ? " primary crowned" : ""}`}
      disabled={!button.enabled}
      aria-label={crowned ? `${button.label} · ${t("row.crowned")}` : button.label}
      onClick={() => send(hire.command)}
    >
      <span className="hire-name">{button.top}</span>
      <span className="hire-cost num">{button.cost}</span>
    </button>
  );
}

/**
 * The cycle, a strip along the foot of the art (08-screens.md 4.5): a manned line loops (under
 * a quarter second it shows a moving stripe); an unmanned one plays the cycle in flight and
 * stops empty.
 */
function CycleBar({ bar }: { bar: Bar }) {
  if (bar.manned) {
    if (bar.seconds < 0.25) return <span className="cycle fast" aria-hidden="true" />;
    return (
      <span className="cycle" aria-hidden="true">
        <i className="loop" style={{ animationDuration: `${bar.seconds}s` }} />
      </span>
    );
  }
  if (bar.elapsed === undefined) return <span className="cycle idle" aria-hidden="true" />;
  return (
    <span className="cycle unmanned" aria-hidden="true">
      <i
        key={bar.until}
        className="once"
        style={{ animationDuration: `${bar.seconds}s`, animationDelay: `-${bar.elapsed}s` }}
      />
    </span>
  );
}

/** Under 740 px tall the collapsed drawer shows one card and a peek (tokens.css). */
export function useShort(): boolean {
  const [short, setShort] = useState(() => window.innerHeight < 740);
  useEffect(() => {
    const onResize = () => setShort(window.innerHeight < 740);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return short;
}

export { BULK_LABEL };
