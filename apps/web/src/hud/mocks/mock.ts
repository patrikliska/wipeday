/**
 * The missions mocks (2026-10-26, a P3-style picks session before R3 S2): static screens behind
 * the dev switch `?mock=<id>&view=<view>`, drawn over the live demo HUD with its own classes, so
 * the owner can pick between daily quests (the R3 plan), Work Orders per run (AdVenture
 * Communist's missions and rank-up) and both, and judge the postcard with the cards as the
 * carried power. Nothing here reaches the domain, the locale or the server; the whole folder
 * goes when the pick is built (as P3's yards did). Read once at load, like `?demo`.
 */
export type Mock = "quests" | "orders" | "both" | "postcard";

const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);

const id = params?.get("mock") ?? null;

export const mock: Mock | null =
  id === "quests" || id === "orders" || id === "both" || id === "postcard" ? id : null;

/** `view=sheet` opens the mock's sheet; `view=done` shows the set finished. */
export const mockView: string | null = params?.get("view") ?? null;

export const mockQuests = mock === "quests" || mock === "both";
export const mockOrders = mock === "orders" || mock === "both";
