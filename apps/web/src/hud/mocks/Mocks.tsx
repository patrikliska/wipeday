import type { IconKind } from "@wipe-day/content/icons";
import { useUi } from "../../state/ui";
import { fmt, t } from "../../state/world";
import { Icon, ResourceIcon } from "../Icon";
import { SheetFrame } from "../Sheet";
import { vars } from "../util";
import { mock, mockOrders, mockQuests, mockView } from "./mock";
import "../../styles/mocks.css";

/*
 * Static mocks for the owner's pick (see `mock.ts`). Strings are hardcoded here on purpose: a
 * mock is not shipped content, and the pick decides which strings ever reach `en.json`.
 */

type Reward = { kind: "drop"; tier: 1 | 2 } | { kind: "scrap"; n: number };

interface Goal {
  icon: { kind: IconKind; id: string };
  text: string;
  value: number;
  goal: number;
  reward: Reward;
  /** Claimed: paid. Ready: met, the reward waits. Open: still counting. */
  state: "claimed" | "ready" | "open";
}

/** A Stone-era run about ten minutes in, six hands on shift (the `STONE_RUN` fixture). */
const ORDERS: Goal[] = [
  {
    icon: { kind: "tier", id: "stone" },
    text: "Reach the Stone era",
    value: 1,
    goal: 1,
    reward: { kind: "drop", tier: 1 },
    state: "claimed",
  },
  {
    icon: { kind: "ui", id: "hand" },
    text: "Put 6 hands on shift",
    value: 6,
    goal: 6,
    reward: { kind: "scrap", n: 1 },
    state: "ready",
  },
  {
    icon: { kind: "line", id: "furnace" },
    text: "Own 50 Furnaces",
    value: 38,
    goal: 50,
    reward: { kind: "scrap", n: 2 },
    state: "open",
  },
  {
    icon: { kind: "ui", id: "finger" },
    text: "Tap 2,000 times",
    value: 1460,
    goal: 2000,
    reward: { kind: "drop", tier: 1 },
    state: "open",
  },
  {
    icon: { kind: "flotsam", id: "crate" },
    text: "Catch 5 airdrops",
    value: 3,
    goal: 5,
    reward: { kind: "scrap", n: 1 },
    state: "open",
  },
  {
    icon: { kind: "ui", id: "frenzy" },
    text: "Trip Frenzy 3 times",
    value: 1,
    goal: 3,
    reward: { kind: "scrap", n: 2 },
    state: "open",
  },
  {
    icon: { kind: "target", id: "ore" },
    text: "Fell the seam 20 times",
    value: 12,
    goal: 20,
    reward: { kind: "drop", tier: 1 },
    state: "open",
  },
  {
    icon: { kind: "currency", id: "supplies" },
    text: "Make 10B supplies",
    value: 6.5e9,
    goal: 1e10,
    reward: { kind: "scrap", n: 3 },
    state: "open",
  },
];

/** The same list with the set finished: five claimed, the Kettle fuelled (`view=done`). */
const ORDERS_DONE: Goal[] = ORDERS.map((goal, i) =>
  i < 5 ? { ...goal, value: goal.goal, state: "claimed" } : goal,
);

const NEEDED = 5;
const STEP_KEYS = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

const QUESTS: Goal[] = [
  {
    icon: { kind: "ui", id: "finger" },
    text: "Tap 500 times",
    value: 500,
    goal: 500,
    reward: { kind: "scrap", n: 1 },
    state: "claimed",
  },
  {
    icon: { kind: "ui", id: "hand" },
    text: "Hire 2 hands",
    value: 1,
    goal: 2,
    reward: { kind: "scrap", n: 1 },
    state: "open",
  },
  {
    icon: { kind: "flotsam", id: "crate" },
    text: "Catch 3 airdrops",
    value: 2,
    goal: 3,
    reward: { kind: "scrap", n: 1 },
    state: "open",
  },
];

function RewardChip({ reward, state }: { reward: Reward; state: Goal["state"] }) {
  return (
    <span className={`mk-reward ${state}`}>
      {reward.kind === "drop" ? (
        <>
          <Icon kind="flotsam" id="sealed_locker" size={16} />
          <span>{t(`drop.tier_${reward.tier}`)}</span>
        </>
      ) : (
        <>
          <ResourceIcon id="scrap" size={16} />
          <span className="num">+{reward.n}</span>
        </>
      )}
      {state === "claimed" ? <span className="mk-tick">✓</span> : null}
    </span>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const fill = Math.min(1, goal.value / goal.goal);
  return (
    <li className={`mk-goal ${goal.state}`}>
      <span className="mk-goal-icon">
        <Icon kind={goal.icon.kind} id={goal.icon.id} size={26} />
      </span>
      <span className="mk-goal-text">
        <span className="mk-goal-name">{goal.text}</span>
        <span className="mk-goal-progress">
          <span className="mk-bar">
            <i style={{ transform: `scaleX(${fill})` }} />
          </span>
          <span className="num">
            {goal.state === "open"
              ? `${fmt(Math.min(goal.value, goal.goal))} / ${fmt(goal.goal)}`
              : goal.state === "ready"
                ? "Ready"
                : "Done"}
          </span>
        </span>
      </span>
      <RewardChip reward={goal.reward} state={goal.state} />
    </li>
  );
}

/** Five segments: one per order the launch needs. */
function Steps({ done, of, small = false }: { done: number; of: number; small?: boolean }) {
  return (
    <span className={`mk-steps${small ? " small" : ""}`} aria-hidden="true">
      {STEP_KEYS.slice(0, of).map((key, i) => (
        <i key={key} className={i < done ? "on" : ""} />
      ))}
    </span>
  );
}

/**
 * Variant B's card at the top of the shop (desktop column and phone drawer), never reordered
 * (D186): the running order, the steps to the launch, and Open. Orange only while new (D244):
 * here never, the shop's crown stays with the lines.
 */
export function OrdersCard() {
  if (!mockOrders) return null;
  const list = mockView === "done" ? ORDERS_DONE : ORDERS;
  const done = list.filter((goal) => goal.state !== "open").length;
  const ready = list.filter((goal) => goal.state === "ready").length;
  const next =
    list.find((goal) => goal.state === "ready") ?? list.find((goal) => goal.state === "open");
  const fuelled = done >= NEEDED;
  return (
    <div
      className={`card kind-orders mk-orders-card${fuelled ? " fuelled" : ""}`}
      data-key="mock_orders"
      style={vars({ "--tier-color": "var(--tier-stone)" })}
    >
      <div className="thumb">
        <Icon kind="ui" id={fuelled ? "kettle_fuel" : "rank"} size={38} className="thumb-icon" />
        {ready > 0 ? <span className="lvl num mk-ready">{ready}</span> : null}
      </div>
      <div className="mid">
        <div className="name">Work Orders</div>
        <div className="sub">
          {fuelled
            ? "Kettle fuelled · the Big Red is lit"
            : next
              ? `${next.text} · ${next.state === "ready" ? "ready" : `${fmt(next.value)} / ${fmt(next.goal)}`}`
              : ""}
        </div>
        <Steps done={Math.min(done, NEEDED)} of={NEEDED} />
      </div>
      <button type="button" className="btn buy" onClick={() => void 0}>
        <span className="buy-top">{ready > 0 ? "Claim" : "Open"}</span>
        <span className="buy-cost num">{`${Math.min(done, NEEDED)} / ${NEEDED}`}</span>
      </button>
    </div>
  );
}

/** Variant B's sheet: the eight orders, five fuel the Kettle; one primary, Claim or Done. */
function OrdersSheet() {
  const list = mockView === "done" ? ORDERS_DONE : ORDERS;
  const done = list.filter((goal) => goal.state !== "open").length;
  const ready = list.filter((goal) => goal.state === "ready").length;
  const fuelled = done >= NEEDED;
  return (
    <SheetFrame
      id="mock-orders"
      className="mk-sheet"
      title="Work Orders"
      head={
        <p className="sub mk-head">
          <Steps done={Math.min(done, NEEDED)} of={NEEDED} small />
          <span>
            {fuelled
              ? "5 of 5 · the Kettle is fuelled"
              : `${done} of ${NEEDED} fuel the Kettle · run 1`}
          </span>
        </p>
      }
      primary={
        ready > 0 ? `Claim ${ready === 1 ? "1 reward" : `${ready} rewards`}` : t("settings.done")
      }
      onPrimary={() => void 0}
      onClose={() => void 0}
    >
      <div className={`mk-kettle${fuelled ? " lit" : ""}`}>
        <Icon kind="ui" id={fuelled ? "big_red" : "kettle_fuel"} size={28} />
        <span>
          {fuelled
            ? "Fuelled. The Big Red is lit: press it when you choose; the glass is the same either way."
            : `Any ${NEEDED} of the ${list.length} fuel the Kettle. The other ${list.length - NEEDED} are yours to skip.`}
        </span>
      </div>
      <ul className="mk-goals">
        {list.map((goal) => (
          <GoalRow key={goal.text} goal={goal} />
        ))}
      </ul>
      {mock === "both" ? (
        <>
          <h3 className="mk-sub-title">
            <span>Today</span>
            <span className="num">1/3 · new in 9h 12m</span>
          </h3>
          <ul className="mk-goals compact">
            {QUESTS.map((goal) => (
              <GoalRow key={goal.text} goal={goal} />
            ))}
          </ul>
        </>
      ) : null}
    </SheetFrame>
  );
}

/** Variant A: the day's three quests at the top of the Logbook (the R3 plan, 12-feel.md 9.2). */
export function TodayQuests() {
  if (!mockQuests) return null;
  const done = QUESTS.filter((goal) => goal.state !== "open").length;
  return (
    <section className="logbook-chapter mk-today">
      <h3>
        <span>Today</span>
        <span className="num count">{`${done}/3 · new in 9h 12m`}</span>
      </h3>
      <ul className="mk-goals">
        {QUESTS.map((goal) => (
          <GoalRow key={goal.text} goal={goal} />
        ))}
      </ul>
      <p className="mk-note">
        <Icon kind="flotsam" id="sealed_locker" size={16} />
        <span>All three today: a Supply Drop I and +2 scrap.</span>
      </p>
    </section>
  );
}

const CREW: Array<{ id: string; stars: number; rarity: string }> = [
  { id: "mara", stars: 3, rarity: "common" },
  { id: "dax", stars: 2, rarity: "common" },
  { id: "ivo", stars: 2, rarity: "common" },
  { id: "rook", stars: 1, rarity: "rare" },
  { id: "wren", stars: 1, rarity: "rare" },
];

/**
 * The postcard with the carried power in two columns, glass and cards, so the owner can judge
 * how much the cards should carry against Glow (AdComm: the reset gives nothing, cards all).
 */
function Postcard() {
  return (
    <SheetFrame
      id="mock-postcard"
      className="mk-sheet mk-postcard"
      title="Greetings from Ground Zero"
      head={<p className="big num mk-wipe">WIPE DAY #3</p>}
      primary="Rebuild"
      onPrimary={() => void 0}
      onClose={() => void 0}
      closable={false}
    >
      <div className="mk-front" aria-hidden="true">
        <svg viewBox="0 0 300 96" className="mk-crater" role="img" aria-label="The crater">
          <title>The crater</title>
          <rect width="300" height="96" fill="#2a3b2a" />
          <rect y="58" width="300" height="38" fill="#3b2f22" />
          <ellipse cx="150" cy="66" rx="110" ry="20" fill="#1a1208" />
          <ellipse cx="150" cy="63" rx="92" ry="12" fill="#45c2c0" opacity="0.55" />
          <ellipse cx="150" cy="32" rx="38" ry="22" fill="#9a8c74" opacity="0.7" />
          <rect x="132" y="18" width="36" height="34" fill="#d8d0b8" opacity="0.5" />
        </svg>
        <span className="mk-sign num">WIPE DAY #3</span>
      </div>
      <dl className="mk-back">
        <div>
          <dt>Run time</dt>
          <dd className="num">1h 42m</dd>
        </div>
        <div>
          <dt>Crater glass</dt>
          <dd className="num">
            +28 <span className="mk-dim">(61 ever)</span>
          </dd>
        </div>
        <div>
          <dt>Era reached</dt>
          <dd>Sheet Metal</dd>
        </div>
        <div>
          <dt>Best line</dt>
          <dd>Furnace · 41%</dd>
        </div>
      </dl>
      <h3 className="mk-sub-title">
        <span>Carried over</span>
      </h3>
      <div className="mk-carried">
        <div className="mk-carry">
          <span className="mk-carry-head">
            <ResourceIcon id="glass" size={20} />
            <span>Glow</span>
          </span>
          <span className="big num">×1.79 → ×2.17</span>
          <span className="mk-dim">every line and the tap</span>
        </div>
        <div className="mk-carry">
          <span className="mk-carry-head">
            <Icon kind="nav" id="crew" size={20} />
            <span>Crew</span>
          </span>
          <span className="big num">×3.1</span>
          <span className="mk-dim">on their lines, while hired</span>
        </div>
      </div>
      <ul className="mk-crew">
        {CREW.map((card) => (
          <li key={card.id} className={`mk-card ${card.rarity}`}>
            <Icon kind="crew" id={card.id} size={40} />
            <span className="mk-stars">
              {"★".repeat(card.stars)}
              <span className="off">{"★".repeat(5 - card.stars)}</span>
            </span>
          </li>
        ))}
        <li className="mk-card more">
          <span className="num">+2 gear</span>
        </li>
      </ul>
      <p className="mk-next">
        <span className="mk-next-word">Next</span>
        <span>Wipe Day #4 unlocks Toolbelt: Rush</span>
      </p>
      <button type="button" className="btn ghost mk-secondary">
        Blast Map · 5 affordable
      </button>
    </SheetFrame>
  );
}

/** The mock sheets over the HUD; nothing without the switch. */
export function MockLayer() {
  const sheet = useUi((state) => state.sheet);
  if (mock === null) return null;
  if (mock === "postcard") return <Postcard />;
  if (mockOrders && (mockView === "sheet" || mockView === "done") && sheet === null)
    return <OrdersSheet />;
  return null;
}
