/**
 * The reveal (12-feel.md 7.1; D261): opening a Supply Drop sends `open_drop` with the pull count
 * the client saw (a second click is `stale`), and the cards come back on the bus as the
 * predicted `drop_opened` event, in reveal order (D250: the roll is the seed's, so the client
 * knows them at once). The sheet shows them face down; each flip is a tap, in any order, and the
 * card's rarity sounds on its flip, not on the open, so a Legendary rings when it is seen.
 */
import type { DropTier } from "@wipe-day/content/cards";
import { topTier } from "@wipe-day/domain/cards";
import type { DropCard } from "@wipe-day/domain/events";
import { create } from "zustand";
import { emit, on } from "./events";
import { useWorld } from "./store";
import { useUi } from "./ui";

interface RevealState {
  /** The drop being revealed, or null between drops. */
  tier: DropTier | null;
  cards: DropCard[];
  /** Which of `cards` are face up. */
  up: boolean[];
}

interface RevealActions {
  /** Opens one held drop of `tier` (the top tier held when omitted) and shows the reveal. */
  start(tier?: DropTier): void;
  /** Turns card `index` over (the first face-down one when omitted). */
  flip(index?: number): void;
  /** Done: the sheet closes (to the island, or on to the Album when `album`). */
  finish(album: boolean): void;
}

export const useReveal = create<RevealState & RevealActions>((set, get) => ({
  tier: null,
  cards: [],
  up: [],

  start(tier) {
    const base = useWorld.getState().base;
    if (!base) return;
    const pick = tier ?? topTier(base.meta.drops);
    if (pick === null || base.meta.drops.held[pick] <= 0) return;
    set({ tier: pick, cards: [], up: [] });
    useWorld.getState().send({ type: "open_drop", tier: pick, pull: base.meta.drops.pulls });
    // The predicted event filled `cards` synchronously; a refusal left them empty.
    if (get().cards.length === 0) {
      set({ tier: null });
      return;
    }
    if (useUi.getState().sheet !== "reveal") useUi.getState().openSheet("reveal");
  },

  flip(index) {
    const { cards, up } = get();
    const i = index ?? up.findIndex((isUp) => !isUp);
    const card = cards[i];
    if (!card || up[i]) return;
    const next = [...up];
    next[i] = true;
    set({ up: next });
    emit({ type: "card_flipped", rarity: card.rarity });
  },

  finish(album) {
    const ui = useUi.getState();
    set({ tier: null, cards: [], up: [] });
    ui.openSheet(null);
    if (album) {
      ui.setAlbumTab("crew");
      ui.openPanel("album");
    }
  },
}));

/** How many cards are face up. */
export const flippedCount = (up: readonly boolean[]): number => up.filter(Boolean).length;

// The cards of the drop just opened, as the client predicted them (the server's answer wins
// on a conflict, which the store's rebase handles; the reveal shows what the seed says).
on((event) => {
  if (event.type !== "drop_opened") return;
  const state = useReveal.getState();
  if (state.tier === null || state.cards.length > 0) return;
  useReveal.setState({ cards: event.cards, up: event.cards.map(() => false) });
});
