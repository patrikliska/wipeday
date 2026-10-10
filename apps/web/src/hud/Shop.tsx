import type { Command } from "@wipe-day/domain/commands";
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { sound } from "../sound/audio";
import { type AdvisorView, useAdvisor } from "../state/advisor";
import { insets, useColumn } from "../state/layout";
import { useWorld } from "../state/store";
import { BULKS, type Bulk, useUi } from "../state/ui";
import { content, t } from "../state/world";
import { Icon, ResourceIcon } from "./Icon";
import { Nav } from "./Nav";
import { PanelBody } from "./Panels";
import {
  affordableUpgrades,
  type Bar,
  bulkShown,
  collapsedRows,
  crownTab,
  linesTab,
  pickRow,
  type Row,
  upgradesTab,
} from "./rows";
import { tierVar, vars } from "./util";

/** Rows reorder at most this often, and never this soon after a touch (08-screens.md 1.4). */
const REORDER_MS = 2000;
const TOUCH_QUIET_MS = 600;
/** A drag on the handle longer than this opens or closes the drawer (CSS px). */
const DRAG_PX = 30;

const BULK_LABEL: Record<string, string> = {
  "1": "drawer.bulk_one",
  "10": "drawer.bulk_ten",
  "100": "drawer.bulk_hundred",
  max: "drawer.bulk_max",
};

/** The shop appears with its first row: once the first line's price is reached (wireframe 1). */
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

const buy = (command: Command | null): void => {
  if (command) useWorld.getState().send(command);
};

/** The shop: the phone drawer, or the desktop column (08-screens.md 1.4, 1.7). */
export function Shop() {
  const column = useColumn();
  const view = useAdvisor((state) => state.view);
  const open = shopOpen(view);
  useEffect(() => {
    if (!column) insets.right = 0;
  }, [column]);
  if (!view || !open) return null;
  return column ? <Column view={view} /> : <Drawer view={view} />;
}

/** The bulk size in force: ×1 until the toggle exists. */
function useBulk(view: AdvisorView): Bulk {
  const bulk = useUi((state) => state.bulk);
  return bulkShown(view.base) ? bulk : 1;
}

function Drawer({ view }: { view: AdvisorView }) {
  const expanded = useUi((state) => state.expanded);
  const panel = useUi((state) => state.panel);
  const expand = useUi((state) => state.expand);
  const bulk = useBulk(view);
  const ref = useRef<HTMLDivElement>(null);
  const touchedAt = useRef(0);
  const order = useRef<{ keys: string[]; at: number }>({ keys: [], at: 0 });
  const drag = useRef<number | null>(null);
  const short = useShort();

  if (panel) return null;

  // Collapsed: the crowned row and the next by score, reordered calmly.
  let rows = collapsedRows(view, bulk, short ? 2 : 3);
  const nowMs = performance.now();
  const keys = rows.map((row) => row.key);
  const settled = order.current;
  const calm = nowMs - touchedAt.current >= TOUCH_QUIET_MS && nowMs - settled.at >= REORDER_MS;
  if (keys.join() !== settled.keys.join()) {
    const same =
      keys.length === settled.keys.length && keys.every((key) => settled.keys.includes(key));
    if (calm || !same) order.current = { keys, at: nowMs };
    else
      rows = settled.keys
        .map((key) => rows.find((row) => row.key === key))
        .filter((row): row is Row => !!row);
  }

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
    sound.play(next ? "ui_open" : "ui_close");
    expand(next);
  };

  return (
    <div
      ref={ref}
      className={`glass drawer${expanded ? " expanded" : ""}${short ? " short" : ""}`}
      onPointerDown={() => {
        touchedAt.current = performance.now();
      }}
    >
      <div className="handle" onPointerDown={onHandleDown} onPointerUp={onHandleUp}>
        <span className="grabber" aria-hidden="true" />
        {expanded ? (
          <>
            <Tabs view={view} />
            <button type="button" className="btn ghost close-drawer" onClick={() => open(false)}>
              {t("drawer.close")}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn ghost see-all" onClick={() => open(true)}>
              {t("drawer.see_all")}
              <Icon kind="ui" id="chevron" size={16} className="up" />
            </button>
            {bulkShown(view.base) ? <BulkCycle /> : null}
          </>
        )}
      </div>
      {expanded ? (
        <>
          {bulkShown(view.base) ? <BulkSegments /> : null}
          <TabBody view={view} bulk={bulk} crown="tab" />
        </>
      ) : (
        <div className="rows">
          {rows.map((row) => (
            <RowView key={row.key} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Desktop: a permanent column on the right, its nav at its foot (08-screens.md 1.7). */
function Column({ view }: { view: AdvisorView }) {
  const panel = useUi((state) => state.panel);
  const bulk = useBulk(view);
  // The island's crown, pinned over the tabs: the column shares the island's view, so its one
  // crown is always in sight, whichever tab is open (D166).
  const pinned = pickRow(view, bulk);
  const ref = useRef<HTMLDivElement>(null);

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
    <aside ref={ref} className="glass column">
      {panel ? (
        <PanelBody panel={panel} />
      ) : (
        <>
          <div className="column-head">
            <Tabs view={view} />
            {bulkShown(view.base) ? <BulkCycle /> : null}
          </div>
          {bulkShown(view.base) ? <BulkSegments /> : null}
          {pinned ? (
            <div className="pinned">
              <RowView row={pinned} />
            </div>
          ) : null}
          <TabBody view={view} bulk={bulk} crown="none" skip={pinned?.key} />
        </>
      )}
      <Nav inColumn />
    </aside>
  );
}

function Tabs({ view }: { view: AdvisorView }) {
  const tab = useUi((state) => state.tab);
  const setTab = useUi((state) => state.setTab);
  const count = affordableUpgrades(view);
  const select = (next: "lines" | "upgrades") => {
    if (next === tab) return;
    sound.play("ui_toggle");
    setTab(next);
  };
  return (
    <div className="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "lines"}
        className={`tab${tab === "lines" ? " on" : ""}`}
        onClick={() => select("lines")}
      >
        {t("drawer.lines")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "upgrades"}
        className={`tab${tab === "upgrades" ? " on" : ""}`}
        onClick={() => select("upgrades")}
      >
        {t("drawer.upgrades")}
        {count > 0 ? <span className="count num">{count}</span> : null}
      </button>
    </div>
  );
}

function TabBody({
  view,
  bulk,
  crown,
  skip,
}: {
  view: AdvisorView;
  bulk: Bulk;
  /** "tab": the expanded drawer crowns one row per tab; "none": the column's pin has it. */
  crown: "tab" | "none";
  /** A row shown elsewhere (the column's pin). */
  skip?: string | undefined;
}) {
  const tab = useUi((state) => state.tab);
  const boughtOpen = useUi((state) => state.boughtOpen);
  const toggleBought = useUi((state) => state.toggleBought);
  const mark = (rows: Row[]) =>
    crown === "tab" ? crownTab(rows, view) : rows.filter((row) => row.key !== skip);
  if (tab === "lines") {
    const rows = mark(linesTab(view, bulk));
    return (
      <div className="rows scroll" role="tabpanel">
        {rows.map((row) => (
          <RowView key={row.key} row={row} />
        ))}
      </div>
    );
  }
  const tabRows = upgradesTab(view);
  const rows = mark(tabRows.rows);
  const bought = tabRows.bought;
  return (
    <div className="rows scroll" role="tabpanel">
      {rows.length === 0 ? <p className="empty">{t("drawer.empty")}</p> : null}
      {rows.map((row) => (
        <RowView key={row.key} row={row} />
      ))}
      {bought.length > 0 ? (
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
      onClick={() => {
        sound.play("ui_toggle");
        setBulk(next);
      }}
    >
      {t(BULK_LABEL[String(bulk)] ?? "")}
    </button>
  );
}

/** The expanded drawer's segmented control: ×1 · ×10 · ×100 · Max. */
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
            sound.play("ui_toggle");
            setBulk(size);
          }}
        >
          {t(BULK_LABEL[String(size)] ?? "")}
        </button>
      ))}
    </fieldset>
  );
}

/** Under 740 px tall the collapsed drawer shows two rows (08-screens.md 1.1). */
function useShort(): boolean {
  const [short, setShort] = useState(() => window.innerHeight < 740);
  useEffect(() => {
    const onResize = () => setShort(window.innerHeight < 740);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return short;
}

/** One shop row (08-screens.md 2.1): icon block, three lines, the buy button. */
export const RowView = memo(function RowView({ row }: { row: Row }) {
  const lineRow = row.kind === "line";
  return (
    <div
      className={`shop-row kind-${row.kind}${row.locked ? " locked" : ""}${row.crowned ? " crowned" : ""}`}
      style={vars({ "--tier-color": tierVar(row.tier) })}
    >
      <div className="row-icon">
        <Icon kind={row.icon.kind} id={row.icon.id} size={row.kind === "hand" ? 44 : 38} />
        {lineRow && (row.owned ?? 0) > 0 ? <span className="pill num">{row.owned}</span> : null}
        {lineRow && (row.owned ?? 0) > 0 ? (
          row.hand ? (
            <span className="face">
              <Icon kind="crew" id={row.hand} size={18} />
            </span>
          ) : (
            <span className="face finger">
              <Icon kind="ui" id="finger" size={14} />
            </span>
          )
        ) : null}
        {row.mk ? <span className="mk num">{row.mk === 2 ? "II" : "III"}</span> : null}
        {row.locked ? (
          <span className="lock">
            <Icon kind="ui" id="lock" size={14} />
          </span>
        ) : null}
      </div>
      <div className="row-body">
        <div className="row-name">{row.name}</div>
        {lineRow && row.product && (row.owned ?? 0) > 0 ? (
          <div className="row-line2">
            <ResourceIcon id={row.product} size={16} className="badge" />
            {row.bar ? <CycleBar bar={row.bar} /> : null}
            <span className="row-rate num">{row.rate}</span>
          </div>
        ) : row.sub ? (
          <div className="row-sub">{row.sub}</div>
        ) : null}
        {row.progress !== undefined ? (
          <div className="era-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${row.progress})` }} />
          </div>
        ) : null}
        {row.note ? <div className="row-note">{row.note}</div> : null}
      </div>
      <button
        type="button"
        className={`btn buy${row.crowned ? " primary crowned" : ""}`}
        disabled={!row.button.enabled}
        aria-label={row.crowned ? `${row.button.label} · ${t("row.crowned")}` : row.button.label}
        onClick={() => buy(row.command)}
      >
        <span className="buy-top">
          {row.crowned ? <Icon kind="ui" id="crown" size={14} className="crown-mark" /> : null}
          {row.locked ? <Icon kind="ui" id="lock" size={13} /> : null}
          {row.button.top}
        </span>
        {row.button.cost ? (
          <span className="buy-cost num">
            {/* On orange the bundle takes the ink colour, like the words beside it. */}
            {row.crowned ? (
              <Icon kind="currency" id="supplies" size={13} />
            ) : (
              <ResourceIcon id="supplies" size={13} />
            )}
            {row.button.cost}
          </span>
        ) : null}
      </button>
    </div>
  );
}, sameRowView);

/** Rows are rebuilt each second: re-render only when something shown changed. */
function sameRowView(a: { row: Row }, b: { row: Row }): boolean {
  return JSON.stringify(a.row) === JSON.stringify(b.row);
}

/**
 * The cycle bar, a CSS animation (08-screens.md 4.5): a manned bar loops (under a quarter
 * second it shows a moving stripe); an unmanned one plays the cycle in flight and stops empty.
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

export { BULK_LABEL };
