/**
 * The Den's games (W5), scrap only. Every table says before a bet what it pays,
 * how likely that is and what it returns on average (rule 4), and the limits:
 * chips, the biggest bet at this tier and what is left of today's cap. The bet
 * button is the one primary; a disabled chip or button says why.
 *
 * - The Wheel of Salvage: one spin every 30 seconds for everyone; others' bets
 *   show on the segments; the wheel turns to the server's result.
 * - The One-Armed Scavenger: three reels and the shared jackpot.
 * - Bones: two dice.
 */

import {
  diceChance,
  exactRtp,
  jackpotChance,
  wheelChance,
  wheelWeight,
} from "@wipe-day/content/odds";
import type { DiceOption } from "@wipe-day/content/schema";
import {
  betRound,
  casinoLimit,
  casinoToday,
  roundEndsAt,
  type WagerStatus,
  wagerStatus,
} from "@wipe-day/domain/casino";
import { denResetAt } from "@wipe-day/domain/den";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Game, useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  initials,
  segmentColor,
  symbolColor,
  t,
  tierName,
} from "../../state/world";
import { Tile } from "../Icon";
import { vars } from "../util";

const { casino } = content.den;
const GAMES: Game[] = ["wheel", "slots", "dice"];
/** The chips on offer; the ones over this tier's biggest bet stay visible, disabled. */
const CHIPS = [1, 2, 5, 10].map((n) => n * casino.betStep);

const pct = (value: number): string => `${Math.round(value * 100)}%`;
const times = (pays: number): string => `×${pays / 100}`;

export function Games() {
  const base = useWorld((state) => state.base);
  const game = useWorld((state) => state.game);
  const setGame = useWorld((state) => state.setGame);
  const now = useWorld((state) => Math.floor(state.now));
  const limit = casinoLimit(content, base);
  const today = casinoToday(base, now);
  const [bet, setBet] = useState(() => Math.min(CHIPS[1] ?? casino.betStep, limit?.maxBet ?? 0));
  if (!limit) return null;
  const left = Math.max(0, limit.dailyWager - today.wagered);
  const chip = Math.min(bet, limit.maxBet);

  return (
    <>
      <div className="tabs" role="tablist">
        {GAMES.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={game === id}
            className={`tab${game === id ? " on" : ""}`}
            onClick={() => setGame(id)}
          >
            {t(`casino.game.${id}`)}
          </button>
        ))}
      </div>
      {game === "wheel" ? <Wheel bet={chip} chips={<Chips />} /> : null}
      {game === "slots" ? <Slots bet={chip} chips={<Chips />} /> : null}
      {game === "dice" ? <Bones bet={chip} chips={<Chips />} /> : null}
      <div className="limits">
        <div className="row">
          <span className="grow">
            {t("casino.today", { used: abbrev(today.wagered), cap: abbrev(limit.dailyWager) })}
          </span>
          <span className="hint">
            {t("casino.resets", { time: duration(denResetAt(now) - now) })}
          </span>
        </div>
        <div
          className="progress"
          style={vars({ "--bar-color": left === 0 ? "var(--danger)" : "var(--warning)" })}
        >
          <i style={{ width: `${Math.round((today.wagered / limit.dailyWager) * 100)}%` }} />
        </div>
      </div>
      <p className="hint">{t("casino.fine_print")}</p>
    </>
  );

  function Chips() {
    if (!limit) return null;
    return (
      <div className="chips-row">
        {CHIPS.map((value) => {
          const over = value > limit.maxBet;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={chip === value}
              className={`betchip${chip === value ? " on" : ""}`}
              disabled={over}
              title={
                over
                  ? t("casino.chip_over", { amount: limit.maxBet, tier: tierName(base.tier) })
                  : undefined
              }
              onClick={() => setBet(value)}
            >
              {value}
            </button>
          );
        })}
        <span className="hint grow">
          {t("casino.max_bet", { amount: limit.maxBet, tier: tierName(base.tier) })}
        </span>
      </div>
    );
  }
}

/** The bet button's words: what it does, or why it cannot. */
function wagerLabel(status: WagerStatus, now: number, action: string): string {
  switch (status.code) {
    case "ok":
      return action;
    case "unaffordable":
      return t("den.need", { need: `${status.missing.scrap} scrap` });
    case "wager_cap":
      return status.left > 0
        ? t("casino.cap_left", { left: status.left })
        : t("casino.cap_reached", { time: duration(status.resetAt - now) });
    case "max_bet":
      return t("casino.chip_over", { amount: status.amount, tier: tierName(status.tier) });
    case "bad_bet":
      return t("refusal.bad_bet", { step: status.step });
    case "den_closed":
      return t("den.closed", { tier: tierName(status.tier) });
  }
}

// --- the wheel --------------------------------------------------------------------------

const RADIUS = 92;

/** Each segment's arc on the wheel, in degrees from the pointer (12 o'clock), clockwise. */
function arcs(): { id: string; from: number; to: number }[] {
  const total = wheelWeight(casino);
  let at = 0;
  return casino.wheel.segments.map((segment) => {
    const from = at;
    at += (segment.weight / total) * 360;
    return { id: segment.id, from, to: at };
  });
}

function slicePath(from: number, to: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(RADIUS * Math.cos(rad)).toFixed(2)} ${(RADIUS * Math.sin(rad)).toFixed(2)}`;
  };
  const large = to - from > 180 ? 1 : 0;
  return `M0 0 L${point(from)} A${RADIUS} ${RADIUS} 0 ${large} 1 ${point(to)} Z`;
}

function Wheel({ bet, chips }: { bet: number; chips: ReactNode }) {
  const base = useWorld((state) => state.base);
  const board = useWorld((state) => state.board);
  const spin = useWorld((state) => state.spin);
  const me = useWorld((state) => state.player?.id ?? 0);
  const now = useWorld((state) => state.now);
  const wheelBet = useWorld((state) => state.wheelBet);
  const [segment, setSegment] = useState(casino.wheel.segments[0]?.id ?? "");
  const slices = arcs();

  // The wheel turns so the result's slice stops under the pointer, a few turns each spin.
  const turns = useRef(0);
  const [angle, setAngle] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new spin turns the wheel
  useEffect(() => {
    if (!spin) return;
    const slice = slices[spin.segment];
    if (!slice) return;
    turns.current += 4;
    // A little off the slice's middle, so it does not look rigged to the centre.
    const inside = slice.from + (slice.to - slice.from) * (0.3 + ((spin.round * 7) % 5) / 12);
    setAngle(turns.current * 360 - inside);
  }, [spin]);

  const round = betRound(content, Math.floor(now));
  const current = Math.floor(now / casino.wheel.roundSeconds);
  const closed = round > current;
  const spinsIn = roundEndsAt(content, current) - now;
  const status = wagerStatus(content, base, bet, Math.floor(now));
  const chosen = casino.wheel.segments.find((candidate) => candidate.id === segment);
  const bets = board?.bets ?? [];
  const last = board?.results ?? [];
  const rtps = casino.wheel.segments
    .filter((s) => s.pays > 0)
    .map((s) => exactRtp(casino, "wheel", s.id));

  return (
    <>
      <div className="wheel">
        <svg
          viewBox="-100 -104 200 208"
          width="168"
          height="175"
          role="img"
          aria-label={t("casino.game.wheel")}
        >
          <g style={{ transform: `rotate(${angle}deg)` }} className="wheel-disc">
            {slices.map((slice) => (
              <path
                key={slice.id}
                d={slicePath(slice.from, slice.to)}
                fill={segmentColor(slice.id)}
                stroke="#1b1a18"
                strokeWidth={1.5}
              />
            ))}
            <circle r={16} fill="#272521" stroke="#e3a32f" strokeWidth={2} />
          </g>
          <path d="M-9 -104 L9 -104 L0 -86 Z" fill="#ece8df" stroke="#1b1a18" strokeWidth={1.5} />
        </svg>
        <div className="wheel-side">
          <b className="num big">
            {closed
              ? t("casino.closed")
              : `0:${String(Math.max(0, Math.ceil(spinsIn))).padStart(2, "0")}`}
          </b>
          <span className="hint">{closed ? t("casino.next_round") : t("casino.next_spin")}</span>
          <div className="results" title={t("casino.last_spins")}>
            {last.slice(0, 8).map((result) => (
              <i
                key={result.round}
                style={{
                  background: segmentColor(casino.wheel.segments[result.segment]?.id ?? ""),
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="picker">
        {casino.wheel.segments
          .filter((option) => option.pays > 0)
          .map((option) => {
            const on = bets.filter((b) => b.segment === option.id && b.round >= current);
            const mine = base.wheelBets
              .filter((b) => b.segment === option.id)
              .reduce((sum, b) => sum + b.amount, 0);
            return (
              <button
                key={option.id}
                type="button"
                className={`pick${segment === option.id ? " on" : ""}`}
                onClick={() => setSegment(option.id)}
              >
                <i className="swatch" style={{ background: segmentColor(option.id) }} />
                <span className="grow">
                  <b>
                    {t(`casino.segment.${option.id}`)} {times(option.pays)}
                  </b>
                  <span className="sub">
                    {t("casino.chance", { chance: pct(wheelChance(casino, option.id)) })}
                  </span>
                </span>
                <span className="bettors">
                  {mine > 0 ? (
                    <em className="mine">{t("casino.you_bet", { amount: mine })}</em>
                  ) : null}
                  {on
                    .filter((b) => b.playerId !== me)
                    .slice(0, 3)
                    .map((b) => (
                      <em key={`${b.playerId}-${b.round}`} title={b.name}>
                        {initials(b.name)} {b.amount}
                      </em>
                    ))}
                </span>
              </button>
            );
          })}
      </div>
      <p className="hint">
        {t("casino.wheel_odds", {
          low: pct(Math.min(...rtps)),
          high: pct(Math.max(...rtps)),
        })}
      </p>
      {chips}
      <button
        type="button"
        className={`btn wide${status.code === "ok" ? " primary" : ""}`}
        disabled={status.code !== "ok" || !chosen}
        onClick={() => wheelBet(segment, bet)}
      >
        {wagerLabel(
          status,
          Math.floor(now),
          t(closed ? "casino.bet_next" : "casino.bet_on", {
            amount: bet,
            segment: t(`casino.segment.${segment}`),
            win: abbrev((bet * (chosen?.pays ?? 0)) / 100),
          }),
        )}
      </button>
    </>
  );
}

// --- the slots --------------------------------------------------------------------------

function Reel({ symbol, spinning }: { symbol: number; spinning: boolean }) {
  const id = casino.slots.symbols[symbol]?.id ?? "";
  return (
    <div className={`reel${spinning ? " spinning" : ""}`}>
      <Tile
        color={symbolColor(id)}
        label={initials(t(`casino.symbol.${id}`))}
        title={t(`casino.symbol.${id}`)}
      />
    </div>
  );
}

/** The three reels, left to right. */
const REELS = ["left", "middle", "right"] as const;

/** A roll is fresh for this long after it arrives: the reels and dice settle in that time. */
const FRESH = 1.2;

function useFresh(at: number | undefined): boolean {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (at === undefined) return;
    setFresh(true);
    const timer = setTimeout(() => setFresh(false), FRESH * 1000);
    return () => clearTimeout(timer);
  }, [at]);
  return fresh;
}

function Slots({ bet, chips }: { bet: number; chips: ReactNode }) {
  const base = useWorld((state) => state.base);
  const roll = useWorld((state) => (state.roll?.game === "slots" ? state.roll : null));
  const busy = useWorld((state) => state.pending.length > 0);
  const jackpot = useWorld((state) => state.board?.jackpot ?? 0);
  const now = useWorld((state) => Math.floor(state.now));
  const spinSlots = useWorld((state) => state.spinSlots);
  const fresh = useFresh(roll?.at);
  const status = wagerStatus(content, base, bet, now);
  const reels = roll?.result ?? [0, 1, 2];
  const jackpotId = casino.slots.symbols.find((s) => s.jackpot)?.id ?? "";
  const paying = casino.slots.symbols.filter((s) => s.three || s.two);

  return (
    <>
      <div className="jackpot">
        <span className="hint">{t("casino.jackpot")}</span>
        <b className="num big">{abbrev(Math.floor(jackpot / 100))}</b>
        <span className="hint">
          {t("casino.jackpot_terms", {
            symbol: t(`casino.symbol.${jackpotId}`),
            times: casino.slots.jackpot.pays / 100,
            odds: abbrev(Math.round(1 / jackpotChance(casino))),
          })}
        </span>
      </div>
      <div className="reels">
        {REELS.map((reel, index) => (
          <Reel key={reel} symbol={reels[index] ?? 0} spinning={busy} />
        ))}
      </div>
      <p
        className={`outcome${roll && !busy ? (roll.payout > 0 ? " good" : "") : ""}${fresh ? " fresh" : ""}`}
      >
        {busy
          ? t("casino.spinning")
          : roll
            ? roll.payout > 0
              ? t("casino.won", { amount: abbrev(roll.payout) })
              : t("casino.no_luck")
            : t("casino.slots_hint")}
      </p>
      <div className="paytable">
        {paying.map((symbol) => (
          <span key={symbol.id}>
            <Tile
              color={symbolColor(symbol.id)}
              label={initials(t(`casino.symbol.${symbol.id}`))}
            />
            {symbol.three ? `3 ${times(symbol.three)}` : ""}
            {symbol.two ? ` · 2 ${times(symbol.two)}` : ""}
          </span>
        ))}
      </div>
      <p className="hint">{t("casino.returns", { rtp: pct(exactRtp(casino, "slots")) })}</p>
      {chips}
      <button
        type="button"
        className={`btn wide${status.code === "ok" ? " primary" : ""}`}
        disabled={status.code !== "ok" || busy}
        onClick={() => spinSlots(bet)}
      >
        {wagerLabel(status, now, t("casino.spin", { amount: bet }))}
      </button>
    </>
  );
}

// --- bones ------------------------------------------------------------------------------

const SPOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
/** Which of the nine pip spots a face shows. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div className={`die${rolling ? " rolling" : ""}`} role="img" aria-label={String(value)}>
      {SPOTS.map((spot) => (
        <i key={spot} className={PIPS[value]?.includes(spot) ? "on" : ""} />
      ))}
    </div>
  );
}

function Bones({ bet, chips }: { bet: number; chips: ReactNode }) {
  const base = useWorld((state) => state.base);
  const roll = useWorld((state) => (state.roll?.game === "dice" ? state.roll : null));
  const busy = useWorld((state) => state.pending.length > 0);
  const now = useWorld((state) => Math.floor(state.now));
  const rollDice = useWorld((state) => state.rollDice);
  const [option, setOption] = useState<DiceOption>("over");
  const status = wagerStatus(content, base, bet, now);
  const chosen = casino.dice.options.find((candidate) => candidate.id === option);
  const [a, b] = roll?.result ?? [3, 4];

  return (
    <>
      <div className="dice">
        <Die value={a ?? 3} rolling={busy} />
        <Die value={b ?? 4} rolling={busy} />
      </div>
      <p className={`outcome${roll && !busy && roll.payout > 0 ? " good" : ""}`}>
        {busy
          ? t("casino.rolling")
          : roll
            ? roll.payout > 0
              ? t("casino.won", { amount: abbrev(roll.payout) })
              : t("casino.no_luck")
            : t("casino.dice_hint")}
      </p>
      <div className="picker">
        {casino.dice.options.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={`pick${option === candidate.id ? " on" : ""}`}
            onClick={() => setOption(candidate.id)}
          >
            <span className="grow">
              <b>
                {t(`casino.dice.${candidate.id}`)} {times(candidate.pays)}
              </b>
              <span className="sub">
                {t("casino.chance_returns", {
                  chance: pct(diceChance(candidate.id)),
                  rtp: pct(exactRtp(casino, "dice", candidate.id)),
                })}
              </span>
            </span>
          </button>
        ))}
      </div>
      {chips}
      <button
        type="button"
        className={`btn wide${status.code === "ok" ? " primary" : ""}`}
        disabled={status.code !== "ok" || busy}
        onClick={() => rollDice(option, bet)}
      >
        {wagerLabel(
          status,
          now,
          t("casino.roll", {
            amount: bet,
            option: t(`casino.dice.${option}`),
            win: abbrev((bet * (chosen?.pays ?? 0)) / 100),
          }),
        )}
      </button>
    </>
  );
}
