/**
 * Where the player is on the Blast Map (docs/redesign/04-blast-map.md 8; D271): the overview
 * disk (no sector), a sector's ladder, the node whose sheet is open, and the filter chip in
 * force. Nothing here reaches the server; the panel itself is `ui.panel === "map"`. It resets
 * when the panel closes, so the map always opens on the disk (after the first nuke, with
 * Ground Zero lit and the pick pulsing).
 */
import type { NodeTag } from "@wipe-day/domain/blastmap";
import { create } from "zustand";

export type MapFilter = "affordable" | NodeTag;

interface MapState {
  /** The ladder shown, or null for the overview disk. */
  sector: string | null;
  /** The node whose sheet is open. */
  node: string | null;
  filter: MapFilter | null;
  /** Nodes bought in the last moment, for the fill and the edge lighting outward (D64). */
  just: string[];
}

interface MapActions {
  openSector(sector: string | null): void;
  openNode(node: string | null): void;
  setFilter(filter: MapFilter | null): void;
  /** The prediction's juice: `ids` fill now; the mark clears after `ms`. */
  bought(ids: string[], ms?: number): void;
  reset(): void;
}

export const useMap = create<MapState & MapActions>((set, get) => ({
  sector: null,
  node: null,
  filter: null,
  just: [],
  openSector(sector) {
    set({ sector, node: null });
  },
  openNode(node) {
    set({ node });
  },
  setFilter(filter) {
    set({ filter: filter === get().filter ? null : filter });
  },
  bought(ids, ms = 700) {
    set({ just: [...get().just, ...ids] });
    setTimeout(() => {
      set({ just: get().just.filter((id) => !ids.includes(id)) });
    }, ms);
  },
  reset() {
    set({ sector: null, node: null, filter: null, just: [] });
  },
}));
