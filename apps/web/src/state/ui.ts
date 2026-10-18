/**
 * What the HUD shows, apart from the game: the drawer, its tab and bulk size, the open panel or
 * sheet, where the crown is in the shop, and the player's display settings (numbers, motion). Settings live in localStorage
 * (per device), like sound (D162); nothing here reaches the server.
 *
 * Back (08-screens.md 1.8): opening the expanded drawer, the house, a panel or a sheet pushes a history
 * entry, so Android's back button closes the top layer; Escape does the same. A layer opened by
 * the shots harness (a plain `setState`) pushes nothing and closes without touching history.
 */
import { create } from "zustand";

export type Bulk = 1 | 10 | 100 | "max";
export type Tab = "lines" | "upgrades" | "research";
export type Panel = "crew" | "logbook" | "settings";
export type Sheet = "multipliers" | "odds" | "credits";
export type Motion = "device" | "reduced" | "full";

export const BULKS: readonly Bulk[] = [1, 10, 100, "max"];

export interface UiState {
  /** The phone drawer: three rows, or the whole shop. */
  expanded: boolean;
  tab: Tab;
  bulk: Bulk;
  /** A destination of the nav row over the island (Island is none). */
  panel: Panel | null;
  /** A small sheet over everything (the Multipliers sheet, the Odds sheet). */
  sheet: Sheet | null;
  /** "Bought this run" unfolded on the Upgrades tab. */
  boughtOpen: boolean;
  /** The house is open: its room, with the crafting lines inside (D206), over the island. */
  house: boolean;
  scientific: boolean;
  motion: Motion;
  /** Whether the crowned card is on screen in the shop (the Best buy chip shows when not). */
  crownInView: boolean;
  /** Bumped by the Best buy chip: the shop scrolls to the crowned card and pulses it once. */
  focusAt: number;
  /** The hands the Crew sheet last showed, per run: the dock's Crew badge counts the rest. */
  crewSeen: { run: number; hands: number };
  /** The Workshop items open when its tab last showed, per run: the dock's badge counts the rest. */
  workshopSeen: { run: number; items: number };
  /** Badges earned when the Logbook last showed (they last for good): the dock counts the rest. */
  badgesSeen: number;
}

interface UiActions {
  expand(open: boolean): void;
  setTab(tab: Tab): void;
  setBulk(bulk: Bulk): void;
  /** Opens a nav destination; null goes back to the island. */
  openPanel(panel: Panel | null): void;
  openSheet(sheet: Sheet | null): void;
  /** Opens or closes the house's room. */
  openHouse(open: boolean): void;
  toggleBought(): void;
  setScientific(on: boolean): void;
  setMotion(motion: Motion): void;
  /** The Best buy chip: the crown's tab, and a scroll to its card. */
  focusCrown(tab: Tab): void;
  /** The Crew sheet was shown with `hands` on shift in the run started at `run`. */
  seeCrew(run: number, hands: number): void;
  /**
   * The dock's Workshop (D199): the shop on its Workshop tab, the drawer expanded on a phone. A
   * panel open over the island gives its place (and its history entry) to the drawer.
   */
  openWorkshop(column: boolean): void;
  /** The Workshop tab showed `items` open items in run `run`. */
  seeWorkshop(run: number, items: number): void;
  /** The Logbook showed `count` badges earned. */
  seeBadges(count: number): void;
  /** Closes the top layer (sheet, then panel, then the expanded drawer); false when none. */
  back(): boolean;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: the setting lasts for this page.
  }
}

const storedBulk = (): Bulk => {
  const value = read("wipeday.bulk");
  return value === "max" ? "max" : value === "10" ? 10 : value === "100" ? 100 : 1;
};

const storedCrewSeen = (): { run: number; hands: number } => {
  const [run, hands] = (read("wipeday.crew_seen") ?? "").split(":").map(Number);
  return Number.isFinite(run) && Number.isFinite(hands)
    ? { run: run ?? 0, hands: hands ?? 0 }
    : { run: 0, hands: 0 };
};

const storedWorkshopSeen = (): { run: number; items: number } => {
  const [run, items] = (read("wipeday.workshop_seen") ?? "").split(":").map(Number);
  return Number.isFinite(run) && Number.isFinite(items)
    ? { run: run ?? 0, items: items ?? 0 }
    : { run: 0, items: 0 };
};

const storedBadgesSeen = (): number => {
  const value = Number(read("wipeday.badges_seen") ?? "0");
  return Number.isFinite(value) ? value : 0;
};

const storedMotion = (): Motion => {
  const value = read("wipeday.motion");
  return value === "reduced" || value === "full" ? value : "device";
};

/** History entries this page pushed for open layers, so a close can pop its own. */
let pushed = 0;

function pushLayer(): void {
  if (typeof history === "undefined") return;
  history.pushState({ wipeDayLayer: true }, "");
  pushed += 1;
}

export const useUi = create<UiState & UiActions>((set, get) => {
  /** Closes the top layer through history when this page pushed one, so back stays in step. */
  const close = (apply: () => void): void => {
    if (pushed > 0) {
      history.back();
      return;
    }
    apply();
  };
  return {
    expanded: false,
    tab: "lines",
    bulk: storedBulk(),
    panel: null,
    sheet: null,
    boughtOpen: false,
    house: false,
    scientific: read("wipeday.scientific") === "1",
    motion: storedMotion(),
    crownInView: true,
    focusAt: 0,
    crewSeen: storedCrewSeen(),
    workshopSeen: storedWorkshopSeen(),
    badgesSeen: storedBadgesSeen(),

    expand(open) {
      if (open === get().expanded) return;
      if (open) {
        pushLayer();
        set({ expanded: true });
      } else close(() => set({ expanded: false }));
    },
    setTab(tab) {
      set({ tab });
    },
    setBulk(bulk) {
      write("wipeday.bulk", String(bulk));
      set({ bulk });
    },
    openPanel(panel) {
      const current = get().panel;
      if (panel === current) return;
      if (panel === null) {
        close(() => set({ panel: null }));
        return;
      }
      // Switching destinations replaces the panel: one history entry for the panel layer.
      if (current === null) pushLayer();
      set({ panel, expanded: false });
    },
    openSheet(sheet) {
      const current = get().sheet;
      if (sheet === current) return;
      if (sheet === null) {
        close(() => set({ sheet: null }));
        return;
      }
      // One sheet at a time: a sheet opened from another replaces it (one history entry).
      if (current === null) pushLayer();
      set({ sheet });
    },
    openHouse(open) {
      if (open === get().house) return;
      if (open) {
        pushLayer();
        set({ house: true });
      } else close(() => set({ house: false }));
    },
    toggleBought() {
      set({ boughtOpen: !get().boughtOpen });
    },
    setScientific(on) {
      write("wipeday.scientific", on ? "1" : "0");
      set({ scientific: on });
    },
    setMotion(motion) {
      write("wipeday.motion", motion);
      set({ motion });
    },
    focusCrown(tab) {
      set({ tab, focusAt: get().focusAt + 1 });
    },
    seeCrew(run, hands) {
      const seen = get().crewSeen;
      if (seen.run === run && seen.hands === hands) return;
      write("wipeday.crew_seen", `${run}:${hands}`);
      set({ crewSeen: { run, hands } });
    },
    openWorkshop(column) {
      const state = get();
      if (state.panel !== null) {
        // The panel's history entry now stands for the expanded drawer (one layer, one entry).
        set({ panel: null, tab: "research", expanded: !column || state.expanded });
        return;
      }
      set({ tab: "research" });
      if (!column) get().expand(true);
    },
    seeWorkshop(run, items) {
      const seen = get().workshopSeen;
      if (seen.run === run && seen.items === items) return;
      write("wipeday.workshop_seen", `${run}:${items}`);
      set({ workshopSeen: { run, items } });
    },
    seeBadges(count) {
      if (get().badgesSeen === count) return;
      write("wipeday.badges_seen", String(count));
      set({ badgesSeen: count });
    },
    back() {
      const state = get();
      if (state.sheet) set({ sheet: null });
      else if (state.panel) set({ panel: null });
      else if (state.expanded) set({ expanded: false });
      else if (state.house) set({ house: false });
      else return false;
      return true;
    },
  };
});

/** Android back and the browser's back button close the top layer this page opened. */
export function installBack(): () => void {
  const onPop = () => {
    if (pushed > 0) pushed -= 1;
    useUi.getState().back();
  };
  window.addEventListener("popstate", onPop);
  return () => window.removeEventListener("popstate", onPop);
}

/** Escape closes the top layer (through history when it pushed one). */
export function closeTop(): boolean {
  const state = useUi.getState();
  if (state.sheet) state.openSheet(null);
  else if (state.panel) state.openPanel(null);
  else if (state.expanded) state.expand(false);
  else if (state.house) state.openHouse(false);
  else return false;
  return true;
}

/** Back to the island at once: every layer closes (a refusal's "Tap the ore seam"). */
export function closeAll(): void {
  useUi.setState({ sheet: null, panel: null, expanded: false, house: false });
}

const deviceReduced =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;

/** Reduced motion (08-screens.md 6.2): the setting, or the device when it says "Match device". */
export function reducedMotion(): boolean {
  const motion = useUi.getState().motion;
  if (motion !== "device") return motion === "reduced";
  return deviceReduced?.matches === true;
}
