/**
 * Demo mode: the whole game in the browser, on the same domain rules as the
 * server, over the demo clock (fast, pausable). Used by `?demo`, by the dev
 * server when no API is running, and by the screenshot script, which also
 * patches the state directly through `patch`.
 *
 * The Den (W5) is played here too: a made-up seller's listings on the board, a
 * secret drawn per page load for the wheel, and a jackpot. The wheel turns on the
 * demo clock, so at 240× a round passes in a blink (like node regrow, D65).
 *
 * Raids (W6): Hollis keeps a Sheet Metal holdfast in the raids, so the PvP tab has a
 * target; a raid on it plays both halves here, as the server would.
 */
import { type BaseState, newBase } from "@wipe-day/domain/base";
import { nextWheelAt, roundOf, wheelResult } from "@wipe-day/domain/casino";
import { applyCommand, type Command } from "@wipe-day/domain/commands";
import type { GameEvent } from "@wipe-day/domain/events";
import { type FeedItem, isFeedWorthy, type NotifyPrefs } from "@wipe-day/domain/feed";
import { leaderboards, seasonSummary } from "@wipe-day/domain/leaderboard";
import type { MarketListing } from "@wipe-day/domain/market";
import { hitOf, pvpOdds, pvpStatus, type RaidTarget, takeRaid } from "@wipe-day/domain/raids";
import { seedOf } from "@wipe-day/domain/rng";
import { settleAll } from "@wipe-day/domain/settle";
import type {
  CommandResponse,
  DenBoard,
  DenPush,
  MeResponse,
  PriceHistory,
  PushMessage,
  RaidsResponse,
  RanksResponse,
  StateResponse,
  WheelBetView,
} from "@wipe-day/domain/wire";
import type { World } from "@wipe-day/domain/world";
import { DEMO_SEASON_START, demoClocks } from "../state/clocks";
import { content, t } from "../state/world";
import type { Backend, NotifySettings, ServerConfig } from "./backend";

/** A base a few days in, so the demo shows the living base rather than an empty shore. */
function demoBase(now: number): BaseState {
  return {
    ...newBase(content, now - 3 * 3600, 20260928),
    tier: "wood",
    toolId: "stone_tools",
    stock: {
      timber: 1840,
      stone: 1210,
      ore: 260,
      sulfur_ore: 40,
      fibre: 90,
      ingots: 120,
      food: 60,
      scrap: 14,
      planks: 30,
      rope: 5,
    },
    items: { crate: 2, bow: 1, roast: 1 },
    buildings: { workbench: 1, campfire: 1, furnace: 1, garden: 1, loom: 1 },
    // The workbench is busy, so the first look shows a station at work.
    production: {
      workbench: [{ recipe: "planks", count: 5, done: 0, unitSeconds: 120, startedAt: now - 60 }],
    },
    lastCollectedAt: now - 3600,
    lastGatherAt: now - 20 * 60,
    upkeepPaidUntil: now,
    barrel: { spawnedAt: now - 15 * 60, expiresAt: now + 30 * 60, seed: 42 },
    nextBarrelAt: now + 4 * 3600,
  };
}

/** Hollis's holdfast (W6): Sheet Metal, in the raids, walls and a turret, a full yard. */
function rivalBase(now: number): BaseState {
  const base = newBase(content, now - 9 * 86400, 77);
  return {
    ...base,
    tier: "metal",
    toolId: "salvaged_tools",
    buildings: { walls: 2, traps: 1, watchtower: 2, turret: 1 },
    stock: { timber: 42_000, stone: 51_000, ingots: 18_500, sulfur: 2400, scrap: 1900 },
    lastCollectedAt: now,
    upkeepPaidUntil: now + 30 * 86400,
    pvp: { ...base.pvp, on: true },
  };
}

/** The demo's other player: a smuggler with a few things on the board. */
const SELLER = { id: 9, name: "Hollis" };

function demoListings(now: number): MarketListing[] {
  const offers: [string, number, number, number][] = [
    ["rope", 200, 40, 30],
    ["gears", 20, 95, 9],
    ["tin_keycode", 1, 80, 41],
    ["leather", 40, 40, 20],
  ];
  return offers.map(([good, amount, price, hoursLeft], index) => ({
    id: 900 + index,
    seller: SELLER.id,
    sellerName: SELLER.name,
    local: `l${index + 1}`,
    good,
    amount,
    price,
    listedAt: now - 3600,
    expiresAt: now + hoursLeft * 3600,
  }));
}

const randomSeed = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] ?? 0) >>> 1;
};

export class LocalBackend implements Backend {
  readonly mode = "demo";
  readonly clock = demoClocks.game;
  readonly loginUrl = "";
  private base: BaseState;
  private version = 1;
  /** The demo's feed: only the player's own happenings (there is nobody else). */
  private feedItems: FeedItem[] = [];
  private feedListener: ((items: FeedItem[]) => void) | null = null;
  private pushListener: ((message: PushMessage) => void) | null = null;
  private denListener: ((message: DenPush) => void) | null = null;
  private readonly secret = randomSeed();
  private jackpot = 18_340;
  /** The player's own listings on the demo board; Hollis's are made fresh on every look. */
  private listings: MarketListing[] = [];
  /** Hollis's listings bought in this demo. */
  private boughtIds = new Set<number>();
  private bets: WheelBetView[] = [];
  /** Hollis's holdfast, the demo's raid target (W6). */
  private rival: BaseState;
  /** The demo season's announced end and next modifier (W7). */
  private seasonEnds: number | null = null;
  private seasonNext: string | null = null;
  private readonly player: MeResponse = {
    id: 0,
    name: t("hud.demo_player"),
    avatarUrl: null,
    devLogin: false,
  };

  constructor() {
    this.base = demoBase(this.clock.now());
    this.rival = rivalBase(this.clock.now());
    // The wheel spins on the demo clock: settle the bets whose round has ended.
    setInterval(() => this.spin(), 400);
  }

  private reveal = (round: number): number => wheelResult(content, seedOf(round, this.secret));

  private world(command?: Command): World {
    const world: World = {
      reveal: this.reveal,
      jackpot: this.jackpot,
      seed: randomSeed(),
      self: this.player.id,
    };
    if (command?.type === "market_buy") {
      const listing = this.board().find((candidate) => candidate.id === command.listing);
      if (listing) world.listing = listing;
    }
    if (command?.type === "raid_player" && command.target === SELLER.id) {
      world.target = this.target();
      world.selfName = this.player.name;
    }
    return world;
  }

  async config(): Promise<ServerConfig> {
    return { devLogin: false, discordLogin: false };
  }

  async me(): Promise<MeResponse> {
    return this.player;
  }

  async state(): Promise<StateResponse> {
    const now = this.clock.now();
    const settled = settleAll(content, this.base, now, this.world());
    this.base = settled.state;
    this.followDen(settled.events);
    return {
      serverNow: now,
      version: this.version,
      player: this.player,
      seasonStartedAt: DEMO_SEASON_START,
      season: this.season(),
      state: this.base,
      // The demo opens as if the player had been away, so the welcome back shows.
      welcomeBack: this.version === 1 ? { awaySeconds: 3 * 3600, events: [] } : null,
    };
  }

  async command(_key: string, command: Command): Promise<CommandResponse> {
    const now = this.clock.now();
    const result = applyCommand(content, this.base, command, now, this.world(command));
    this.base = result.state;
    this.version += 1;
    this.record(result.events, now);
    this.followDen(result.events);
    if (result.ok && command.type === "market_buy") {
      this.boughtIds.add(command.listing);
      this.denListener?.({ kind: "board" });
    }
    const launched = result.events.find((event) => event.type === "raid_launched");
    if (result.ok && launched?.type === "raid_launched") {
      const hit = hitOf(launched.report, this.player.id, this.player.name);
      this.rival = takeRaid(content, this.rival, hit, now).state;
    }
    return result.ok
      ? {
          ok: true,
          serverNow: now,
          version: this.version,
          state: result.state,
          events: result.events,
        }
      : {
          ok: false,
          serverNow: now,
          version: this.version,
          state: result.state,
          events: result.events,
          refusal: result.refusal,
        };
  }

  /** The board, the jackpot and the bets follow the events, as the server's tables do. */
  private followDen(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case "listed":
          this.listings.unshift({
            ...event.listing,
            id: 1000 + this.base.listingSeq,
            seller: this.player.id,
            sellerName: this.player.name,
            local: event.listing.id,
          });
          this.denListener?.({ kind: "board" });
          break;
        case "listing_cancelled":
        case "listing_expired":
          this.listings = this.listings.filter(
            (listing) => !(listing.seller === this.player.id && listing.local === event.listing),
          );
          this.denListener?.({ kind: "board" });
          break;
        case "wheel_bet": {
          const bet = { ...event, playerId: this.player.id, name: this.player.name };
          this.bets.push(bet);
          this.denListener?.({ kind: "bet", bet });
          break;
        }
        case "wager":
          this.jackpot += event.feed;
          this.denListener?.({ kind: "jackpot", jackpot: this.jackpot });
          break;
        case "jackpot_won":
          this.jackpot = 0;
          this.denListener?.({ kind: "jackpot", jackpot: 0 });
          break;
        default:
          break;
      }
    }
  }

  /** Lands the wheel's spins on the demo clock and pushes the result, like the server. */
  private spin(): void {
    const now = this.clock.now();
    const due = nextWheelAt(content, this.base);
    if (due === null || due > now) return;
    const rounds = [...new Set(this.base.wheelBets.map((bet) => bet.round))];
    const settled = settleAll(content, this.base, now, this.world());
    this.base = settled.state;
    this.version += 1;
    this.record(settled.events, now);
    this.pushListener?.({
      version: this.version,
      serverNow: now,
      state: this.base,
      events: settled.events,
      origin: null,
    });
    for (const round of rounds)
      this.denListener?.({ kind: "result", round, segment: this.reveal(round) });
    this.bets = this.bets.filter((bet) => !rounds.includes(bet.round));
  }

  private record(events: GameEvent[], at: number): void {
    const items = events.filter(isFeedWorthy).map((event, index) => ({
      id: this.version * 100 + index,
      at,
      playerId: this.player.id,
      playerName: this.player.name,
      event,
    }));
    if (items.length === 0) return;
    this.feedItems = [...items.reverse(), ...this.feedItems].slice(0, 100);
    this.feedListener?.(items);
  }

  subscribe(
    onPush: (message: PushMessage) => void,
    _onReconnect: () => void,
    onFeed: (items: FeedItem[]) => void,
    onDen: (message: DenPush) => void,
  ): () => void {
    this.feedListener = onFeed;
    this.pushListener = onPush;
    this.denListener = onDen;
    return () => {
      this.feedListener = null;
      this.pushListener = null;
      this.denListener = null;
    };
  }

  /** Open listings now: the player's own and Hollis's not yet bought. */
  private board(): MarketListing[] {
    const now = this.clock.now();
    return [
      ...this.listings,
      ...demoListings(now).filter((listing) => !this.boughtIds.has(listing.id)),
    ].filter((listing) => listing.expiresAt > now);
  }

  async den(): Promise<DenBoard> {
    const now = this.clock.now();
    const round = roundOf(content, now);
    return {
      serverNow: now,
      listings: this.board(),
      round,
      bets: this.bets.filter((bet) => bet.round >= round),
      results: Array.from({ length: 10 }, (_, index) => round - 1 - index).map((past) => ({
        round: past,
        segment: this.reveal(past),
      })),
      jackpot: this.jackpot,
    };
  }

  /** A made-up week of trading, so the price chart has something to show. */
  async history(good: string): Promise<PriceHistory> {
    const ref = content.den.market.refPer100[good] ?? 1;
    const today = Math.floor(this.clock.now() / 86400);
    return {
      good,
      days: [6, 5, 3, 2, 1, 0].map((ago) => ({
        day: today - ago,
        per100: ref * (0.8 + 0.1 * ((ago * 7 + good.length) % 5)),
        amount: 100,
      })),
    };
  }

  async ranks(): Promise<RanksResponse> {
    const now = this.clock.now();
    const rival: BaseState = {
      ...this.base,
      tier: "stone",
      stock: { scrap: 640, timber: 9000, stone: 7000 },
      buildings: { workbench: 2, furnace: 2, campfire: 1 },
      stats: { ...this.base.stats, sites: ["beach_wreck", "quarry"], traded: 180, biggestWin: 56 },
    };
    const entries = [
      { playerId: this.player.id, name: this.player.name, state: this.base },
      { playerId: SELLER.id, name: SELLER.name, state: rival },
    ];
    const boards = leaderboards(content, entries, now);
    return {
      boards,
      me: seasonSummary(content, this.base, boards, this.player.id, DEMO_SEASON_START),
    };
  }

  /** The demo's season (W7): the base's own, with the end and next modifier if set. */
  private season() {
    return {
      number: this.base.season.number,
      startedAt: DEMO_SEASON_START,
      endsAt: this.seasonEnds,
      modifier: this.base.season.modifier,
      next: this.seasonNext,
    };
  }

  /** Hollis, settled to now, as the server would hand it to a raid. */
  private target(): RaidTarget {
    const now = this.clock.now();
    this.rival = settleAll(content, this.rival, now).state;
    return { ...SELLER, state: this.rival };
  }

  async raids(): Promise<RaidsResponse> {
    const now = this.clock.now();
    const target = this.target();
    return {
      serverNow: now,
      targets: [
        {
          id: target.id,
          name: target.name,
          tier: target.state.tier,
          status: pvpStatus(content, this.base, this.player.id, target, now),
          odds: pvpOdds(content, this.base, target, now),
          shieldUntil: target.state.pvp.shieldUntil,
        },
      ],
    };
  }

  /** Screenshots: Hollis's holdfast (a shield, a revenge token on the player's side...). */
  patchRival(change: Partial<BaseState>): void {
    this.rival = { ...this.rival, ...change };
  }

  async feed(before?: number): Promise<FeedItem[]> {
    return this.feedItems.filter((item) => before === undefined || item.id < before);
  }

  /** The demo has no server to push from. */
  async notify(): Promise<NotifySettings | null> {
    return null;
  }

  async setNotify(): Promise<NotifyPrefs> {
    throw new Error("no notifications in demo mode");
  }

  async pushSubscribe(): Promise<void> {}
  async pushUnsubscribe(): Promise<void> {}

  /** Demo drawer and screenshots: overwrite parts of the base. Returns the new base. */
  patch(change: Partial<BaseState>): { state: BaseState; version: number } {
    this.base = { ...this.base, ...change };
    this.version += 1;
    return { state: this.base, version: this.version };
  }

  /** Screenshots: other players' bets on the wheel and the jackpot. */
  patchDen(change: { bets?: WheelBetView[]; jackpot?: number }): void {
    if (change.bets) this.bets = change.bets;
    if (change.jackpot !== undefined) this.jackpot = change.jackpot;
  }

  async devLogin(): Promise<void> {}
  async logout(): Promise<void> {}
}
