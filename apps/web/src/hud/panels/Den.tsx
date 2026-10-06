/**
 * The Den (W5): the smugglers' trading post. Three tabs:
 * - Market: the Den's own counter (today's offers), what other players have up,
 *   your listings, and the sell form (amount, price against the Den's rate and the
 *   last two weeks' trades, the fee and what you get, before anything is listed);
 * - Contracts: the Den's orders for today, with have/need and the pay;
 * - Games: the Wheel of Salvage, the One-Armed Scavenger and Bones (`Games.tsx`).
 * Every rule comes from the domain (`den.ts`, `market.ts`, `contracts.ts`).
 */
import { nextTier, nextTool, shortfall, tierOf, toolUnlocked } from "@wipe-day/domain/base";
import { contractOf, deliverStatus, termsOf } from "@wipe-day/domain/contracts";
import {
  type DenBuyStatus,
  denBuyStatus,
  denOpen,
  denResetAt,
  lotsLeft,
  offerOf,
  offerPrice,
} from "@wipe-day/domain/den";
import { held, isItem, isTradeable } from "@wipe-day/domain/goods";
import {
  type BuyStatus,
  buyStatus,
  type ListStatus,
  listingFee,
  listStatus,
  type MarketListing,
  per100,
  priceFloor,
  refPrice,
} from "@wipe-day/domain/market";
import type { PriceHistory } from "@wipe-day/domain/wire";
import { useEffect, useState } from "react";
import { currentBackend, type DenTab, useWorld } from "../../state/store";
import {
  abbrev,
  content,
  duration,
  missingLabel,
  outputName,
  t,
  tierName,
} from "../../state/world";
import { ItemIcon, ResourceIcon } from "../Icon";
import { Games } from "./Games";

export function GoodIcon({ id, className }: { id: string; className?: string }) {
  return isItem(content, id) ? (
    <ItemIcon id={id} className={className} />
  ) : (
    <ResourceIcon id={id} className={className} />
  );
}

/** "50 Planks", "Bow". */
function lot(good: string, amount: number): string {
  return isItem(content, good) && amount === 1
    ? outputName(good)
    : t("den.lot", { amount: abbrev(amount), good: outputName(good) });
}

const TABS: DenTab[] = ["market", "contracts", "games"];

export function DenPanel() {
  const base = useWorld((state) => state.base);
  const tab = useWorld((state) => state.denTab);
  const setTab = useWorld((state) => state.setDenTab);
  const loadDen = useWorld((state) => state.loadDen);
  const openPanel = useWorld((state) => state.openPanel);

  useEffect(() => {
    void loadDen();
  }, [loadDen]);

  if (!denOpen(content, base)) {
    return (
      <>
        <p className="hint">{t("den.blurb")}</p>
        <div className="card locked">
          <div className="main">
            <b>{t("den.closed", { tier: tierName(content.den.open.tier) })}</b>
            <div className="desc">{t("den.closed_sub")}</div>
          </div>
        </div>
        <button type="button" className="btn wide primary" onClick={() => openPanel("build")}>
          {t("den.to_build")}
        </button>
      </>
    );
  }

  const deliverable = base.contracts.ids.some(
    (id) => deliverStatus(content, base, id).code === "ok",
  );
  return (
    <>
      <div className="den-top">
        <div className="tabs" role="tablist">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab${tab === id ? " on" : ""}`}
              onClick={() => setTab(id)}
            >
              {t(`den.tab_${id}`)}
              {id === "contracts" && deliverable ? <i className="dot" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <Wallet />
      </div>
      {tab === "market" ? <Market /> : null}
      {tab === "contracts" ? <Contracts /> : null}
      {tab === "games" ? <Games /> : null}
    </>
  );
}

/** Scrap is the Den's money: always in sight while there. */
function Wallet() {
  const scrap = useWorld((state) => Math.floor(state.base.stock.scrap ?? 0));
  return (
    <div className="wallet" title={t("den.scrap")}>
      <ResourceIcon id="scrap" />
      <b className="num">{abbrev(scrap)}</b>
    </div>
  );
}

/** Words for a button that cannot buy: why not. */
function buyLabel(status: DenBuyStatus | BuyStatus, now: number): string {
  switch (status.code) {
    case "unaffordable":
      return t("den.need", { need: missingLabel(status.missing) ?? "" });
    case "sold_out":
      return t("den.sold_out", { time: duration(status.resetAt - now) });
    case "all_known":
      return t("den.all_known");
    case "no_room":
      return t("den.no_room", { room: abbrev(status.room) });
    case "own_listing":
      return t("den.yours");
    case "listing_gone":
      return t("den.gone");
    case "den_closed":
      return t("den.closed", { tier: tierName(status.tier) });
    case "no_offer":
      return t("den.no_offer");
    case "ok":
      return "";
  }
}

/** The good the next tier or tool is short of, so the counter can point at it. */
function wantedGoods(): Set<string> {
  const base = useWorld.getState().base;
  const out = new Set<string>();
  const tier = nextTier(base.tier);
  if (tier)
    for (const id of Object.keys(shortfall(tierOf(content, tier).cost, base.stock))) out.add(id);
  const tool = nextTool(content, base);
  if (tool && toolUnlocked(base, tool))
    for (const id of Object.keys(shortfall(tool.cost, base.stock))) out.add(id);
  return out;
}

function Market() {
  const selling = useWorld((state) => state.denSell);
  const setSelling = useWorld((state) => state.setDenSell);
  if (selling !== undefined)
    return <SellForm good={selling} onPick={setSelling} onDone={() => setSelling(undefined)} />;
  return <Board onSell={() => setSelling(null)} />;
}

function Board({ onSell }: { onSell: () => void }) {
  const base = useWorld((state) => state.base);
  const board = useWorld((state) => state.board);
  const me = useWorld((state) => state.player?.id ?? 0);
  const pending = useWorld((state) => state.pending.length > 0);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const denBuy = useWorld((state) => state.denBuy);
  const buyListing = useWorld((state) => state.buyListing);
  const cancel = useWorld((state) => state.cancelListing);
  const wanted = wantedGoods();
  const offers = base.den.offers.flatMap((id) => {
    const offer = offerOf(content, id);
    return offer ? [{ offer, status: denBuyStatus(content, base, id, 1, now) }] : [];
  });
  // One primary: the counter's offer the next goal is short of, else putting something up.
  const primary = offers.find(({ offer, status }) => status.code === "ok" && wanted.has(offer.good))
    ?.offer.id;
  const others = (board?.listings ?? []).filter((listing) => listing.seller !== me);
  const mine = base.listings;
  const { maxListings } = content.den.market;

  return (
    <>
      <h3 className="section">{t("den.counter")}</h3>
      <p className="hint">{t("den.counter_hint", { time: duration(denResetAt(now) - now) })}</p>
      {offers.map(({ offer, status }) => {
        const price = offerPrice(content, offer);
        const left = lotsLeft(base, offer);
        const blueprint = offer.good === "blueprint";
        return (
          <div key={offer.id} className={`card${status.code === "ok" ? "" : " locked"}`}>
            {blueprint ? <span className="tile bp">BP</span> : <GoodIcon id={offer.good} />}
            <div className="main">
              <div className="title">
                <b>{blueprint ? t("den.blueprint") : lot(offer.good, offer.lot)}</b>
                <span className="lvl">{t("den.left_today", { count: left })}</span>
              </div>
              <div className="desc">
                {blueprint
                  ? t("den.blueprint_sub")
                  : wanted.has(offer.good)
                    ? t("den.wanted", { good: outputName(offer.good).toLowerCase() })
                    : t("den.have", { count: abbrev(held(content, base, offer.good)) })}
              </div>
              <button
                type="button"
                className={`btn${offer.id === primary ? " primary" : ""}`}
                disabled={status.code !== "ok"}
                onClick={() => denBuy(offer.id, 1)}
              >
                {status.code === "ok"
                  ? t("den.buy", { price: abbrev(price) })
                  : buyLabel(status, now)}
              </button>
            </div>
          </div>
        );
      })}

      <h3 className="section">{t("den.players")}</h3>
      {others.length === 0 ? <p className="hint">{t("den.players_empty")}</p> : null}
      {others.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          status={buyStatus(content, base, listing, me, now)}
          now={now}
          pending={pending}
          onBuy={() => buyListing(listing.id)}
        />
      ))}

      <h3 className="section">{t("den.yours_title", { count: mine.length, max: maxListings })}</h3>
      {mine.map((listing) => (
        <div key={listing.id} className="card">
          <GoodIcon id={listing.good} />
          <div className="main">
            <div className="title">
              <b>{lot(listing.good, listing.amount)}</b>
              <span className="lvl">{t("den.price", { price: abbrev(listing.price) })}</span>
            </div>
            <div className="desc">
              {t("den.up_for", { time: duration(listing.expiresAt - now) })}
            </div>
            <button type="button" className="btn small" onClick={() => cancel(listing.id)}>
              {t("den.cancel")}
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={`btn wide${primary ? "" : " primary"}`}
        disabled={mine.length >= maxListings}
        onClick={onSell}
      >
        {mine.length >= maxListings ? t("den.list_full", { max: maxListings }) : t("den.sell")}
      </button>
    </>
  );
}

function ListingCard({
  listing,
  status,
  now,
  pending,
  onBuy,
}: {
  listing: MarketListing;
  status: BuyStatus;
  now: number;
  pending: boolean;
  onBuy: () => void;
}) {
  const ref = content.den.market.refPer100[listing.good] ?? 0;
  const rate = per100(listing.price, listing.amount);
  const compare = rate < ref * 0.95 ? "below" : rate > ref * 1.05 ? "above" : "at";
  return (
    <div className={`card${status.code === "ok" ? "" : " locked"}`}>
      <GoodIcon id={listing.good} />
      <div className="main">
        <div className="title">
          <b>{lot(listing.good, listing.amount)}</b>
          <span className="lvl">{listing.sellerName}</span>
        </div>
        <div className="desc">
          {t(`den.rate_${compare}`)} · {t("den.left", { time: duration(listing.expiresAt - now) })}
        </div>
        <button
          type="button"
          className="btn"
          disabled={status.code !== "ok" || pending}
          onClick={onBuy}
        >
          {status.code === "ok"
            ? t("den.buy", { price: abbrev(listing.price) })
            : buyLabel(status, now)}
        </button>
      </div>
    </div>
  );
}

/** Goods worth listing: what the base holds that the Den trades. */
function sellable(): string[] {
  const base = useWorld.getState().base;
  return Object.keys(content.den.market.refPer100).filter(
    (good) => isTradeable(content, good) && held(content, base, good) > 0,
  );
}

/** A comfortable step for an amount or a price: about a tenth, rounded to a nice number. */
function niceStep(value: number): number {
  const rough = Math.max(1, value / 10);
  const power = 10 ** Math.floor(Math.log10(rough));
  return Math.max(1, Math.round(rough / power) * power);
}

function listLabel(status: ListStatus, amount: number, good: string, price: number): string {
  switch (status.code) {
    case "ok":
      return t("den.list", { what: lot(good, amount), price: abbrev(price) });
    case "unaffordable":
      return t("den.need", { need: missingLabel(status.missing) ?? "" });
    case "price_floor":
      return t("den.floor", { price: abbrev(status.price) });
    case "listing_cap":
      return t("den.list_full", { max: status.count });
    case "den_closed":
      return t("den.closed", { tier: tierName(status.tier) });
    case "not_tradeable":
      return t("refusal.not_tradeable");
  }
}

function SellForm({
  good,
  onPick,
  onDone,
}: {
  good: string | null;
  onPick: (good: string | null) => void;
  onDone: () => void;
}) {
  const base = useWorld((state) => state.base);
  const list = useWorld((state) => state.list);
  const have = good ? held(content, base, good) : 0;
  const [amount, setAmount] = useState(0);
  const [price, setPrice] = useState(0);
  const [history, setHistory] = useState<PriceHistory | null>(null);

  // A new good starts at half of what is held (all of an item) at the Den's rate. Only when
  // the good changes: the steppers own the numbers after that.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `have` must not reset the form
  useEffect(() => {
    if (!good) return;
    const start = isItem(content, good) ? have : Math.max(1, Math.floor(have / 2));
    setAmount(start);
    setPrice(refPrice(content, good, start));
    setHistory(null);
    void currentBackend()
      .history(good)
      .then(setHistory)
      .catch(() => setHistory(null));
  }, [good]);

  if (!good) {
    const goods = sellable();
    return (
      <>
        <div className="row">
          <button type="button" className="btn small" onClick={onDone}>
            {t("den.back")}
          </button>
        </div>
        <h3 className="section">{t("den.pick")}</h3>
        {goods.length === 0 ? <p className="hint">{t("den.nothing_to_sell")}</p> : null}
        <div className="grid">
          {goods.map((id) => (
            <button key={id} type="button" className="slot" onClick={() => onPick(id)}>
              <GoodIcon id={id} />
              <b>{abbrev(held(content, base, id))}</b>
              <span>{outputName(id)}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const units = Math.min(Math.max(1, amount), Math.max(1, have));
  const status = listStatus(content, base, good, units, price);
  const fee = listingFee(content, price);
  const floor = priceFloor(content, good, units);
  const ref = refPrice(content, good, units);
  const amountStep = niceStep(have);
  const priceStep = niceStep(ref);
  const setUnits = (value: number) => {
    const next = Math.min(Math.max(1, value), have);
    setAmount(next);
    // Keep the price per unit as the amount changes.
    setPrice((current) => Math.max(1, Math.round((current * next) / Math.max(1, units))));
  };

  return (
    <>
      <div className="row">
        <button type="button" className="btn small" onClick={() => onPick(null)}>
          {t("den.back_pick")}
        </button>
      </div>
      <div className="card">
        <GoodIcon id={good} />
        <div className="main">
          <div className="title">
            <b>{outputName(good)}</b>
            <span className="lvl">{t("den.have", { count: abbrev(have) })}</span>
          </div>
          <PriceChart good={good} history={history} />
        </div>
      </div>

      <h3 className="section">{t("den.how_many")}</h3>
      <div className="row stepper">
        <button
          type="button"
          className="btn"
          disabled={units <= 1}
          onClick={() => setUnits(units - amountStep)}
          aria-label={t("craft.fewer")}
        >
          −
        </button>
        <b className="num count">{abbrev(units)}</b>
        <button
          type="button"
          className="btn"
          disabled={units >= have}
          onClick={() => setUnits(units + amountStep)}
          aria-label={t("craft.more_units")}
        >
          +
        </button>
        <button
          type="button"
          className="btn grow"
          disabled={units >= have}
          onClick={() => setUnits(have)}
        >
          {t("den.all", { count: abbrev(have) })}
        </button>
      </div>

      <h3 className="section">{t("den.asking")}</h3>
      <div className="row stepper">
        <button
          type="button"
          className="btn"
          disabled={price - priceStep < floor}
          onClick={() => setPrice(Math.max(floor, price - priceStep))}
          aria-label={t("den.cheaper")}
        >
          −
        </button>
        <b className="num count">{abbrev(price)}</b>
        <button
          type="button"
          className="btn"
          onClick={() => setPrice(price + priceStep)}
          aria-label={t("den.dearer")}
        >
          +
        </button>
        <button type="button" className="btn grow" onClick={() => setPrice(ref)}>
          {t("den.den_rate", { price: abbrev(ref) })}
        </button>
      </div>
      <p className="hint">
        {t("den.terms", {
          fee: abbrev(fee),
          price: abbrev(price),
          hours: content.den.market.listingHours,
        })}
      </p>
      <button
        type="button"
        className={`btn wide${status.code === "ok" ? " primary" : ""}`}
        disabled={status.code !== "ok"}
        onClick={() => {
          if (list(good, units, price)) onDone();
        }}
      >
        {listLabel(status, units, good, price)}
      </button>
    </>
  );
}

/**
 * What players paid per 100 over the last two weeks, against the Den's own rate (the
 * dashed line). Bars, not a line: two players trade on few days, and a gap is a gap.
 */
function PriceChart({ good, history }: { good: string; history: PriceHistory | null }) {
  const now = useWorld((state) => state.now);
  const ref = content.den.market.refPer100[good] ?? 0;
  const days = 14;
  const today = Math.floor(now / 86400);
  const byDay = new Map((history?.days ?? []).map((day) => [day.day, day.per100]));
  const top = Math.max(ref * 1.5, ...byDay.values());
  const w = 196;
  const h = 44;
  const bar = w / days;
  const y = (value: number) => h - (value / top) * h;
  const traded = byDay.size;
  return (
    <div className="pricechart">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={t("den.chart_label")}
      >
        {Array.from({ length: days }, (_, index) => {
          const day = today - (days - 1 - index);
          const value = byDay.get(day);
          return value === undefined ? null : (
            <rect
              key={day}
              x={index * bar + 1}
              y={y(value)}
              width={bar - 2}
              height={h - y(value)}
              rx={1.5}
            />
          );
        })}
        <line x1={0} x2={w} y1={y(ref)} y2={y(ref)} />
      </svg>
      <span className="desc">
        {traded === 0
          ? t("den.chart_empty", { ref: per100Label(ref) })
          : t("den.chart", { days: traded, ref: per100Label(ref) })}
      </span>
    </div>
  );
}

const per100Label = (value: number): string =>
  value >= 10 ? abbrev(Math.round(value)) : String(Math.round(value * 10) / 10);

function Contracts() {
  const base = useWorld((state) => state.base);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);
  const deliver = useWorld((state) => state.deliver);
  const { contracts } = base;
  const primary = contracts.ids.find((id) => deliverStatus(content, base, id).code === "ok");
  return (
    <>
      <p className="hint">{t("den.contracts_hint", { time: duration(denResetAt(now) - now) })}</p>
      {contracts.ids.map((id) => {
        const contract = contractOf(content, id);
        if (!contract) return null;
        const terms = termsOf(content, contract, contracts.tier);
        const done = contracts.done.includes(id);
        const status = deliverStatus(content, base, id);
        const have = held(content, base, terms.good);
        return (
          <div key={id} className={`card contract${done ? " locked" : ""}`}>
            <GoodIcon id={terms.good} />
            <div className="main">
              <div className="title">
                <b>{lot(terms.good, terms.amount)}</b>
                <span className="lvl">{t("den.pays", { pay: abbrev(terms.pay) })}</span>
              </div>
              <div className="desc story">{t(`contract.${id}.line`)}</div>
              {done ? null : (
                <div className="progress" style={{ ["--bar-color" as string]: "var(--success)" }}>
                  <i style={{ width: `${Math.round(Math.min(1, have / terms.amount) * 100)}%` }} />
                </div>
              )}
              <div className="desc">
                {done
                  ? t("den.delivered")
                  : t("den.have_of", {
                      have: abbrev(Math.min(have, terms.amount)),
                      need: abbrev(terms.amount),
                    })}
                {terms.blueprint > 0 && !done
                  ? ` · ${t("den.bp_chance", { percent: terms.blueprint })}`
                  : ""}
              </div>
              {done ? null : (
                <button
                  type="button"
                  className={`btn${id === primary ? " primary" : ""}`}
                  disabled={status.code !== "ok"}
                  onClick={() => deliver(id)}
                >
                  {status.code === "ok"
                    ? t("den.deliver", { pay: abbrev(terms.pay) })
                    : status.code === "unaffordable"
                      ? t("den.need", { need: missingLabel(status.missing) ?? "" })
                      : t("den.no_contract")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
