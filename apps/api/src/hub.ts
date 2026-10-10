/**
 * The push channel's fan-out: each player's open tabs subscribe; any change to
 * their base is published to all of them, and new feed items (W4b) to every
 * open tab of every player. In-process only, which is all one API process needs.
 * W8: the Discord bot's stream hears the same feed items, plus DMs.
 */
import type { FeedItem } from "@wipe-day/domain/feed";
import type { DmNote } from "@wipe-day/domain/wire";
import type { PushMessage } from "./game";

type Listener = (message: PushMessage) => void;
type FeedListener = (items: FeedItem[]) => void;
/** What only the Discord bot's stream carries (W8). */
export type BotMessage = { event: "dm"; data: DmNote };
type BotListener = (message: BotMessage) => void;

export class EventHub {
  private readonly listeners = new Map<number, Set<Listener>>();
  private readonly feedListeners = new Set<FeedListener>();
  private readonly botListeners = new Set<BotListener>();

  /** DMs, for the Discord bot (W8). */
  subscribeBot(listener: BotListener): () => void {
    this.botListeners.add(listener);
    return () => this.botListeners.delete(listener);
  }

  broadcastBot(message: BotMessage): void {
    for (const listener of this.botListeners) listener(message);
  }

  subscribeFeed(listener: FeedListener): () => void {
    this.feedListeners.add(listener);
    return () => this.feedListeners.delete(listener);
  }

  /** New feed items, to everyone watching. */
  broadcast(items: FeedItem[]): void {
    if (items.length === 0) return;
    for (const listener of this.feedListeners) listener(items);
  }

  subscribe(playerId: number, listener: Listener): () => void {
    let set = this.listeners.get(playerId);
    if (!set) {
      set = new Set();
      this.listeners.set(playerId, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(playerId);
    };
  }

  publish(playerId: number, message: PushMessage): void {
    for (const listener of this.listeners.get(playerId) ?? []) listener(message);
  }

  /** Open connections, for the health endpoint. */
  get connections(): number {
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }
}
