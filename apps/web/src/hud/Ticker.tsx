import en from "@wipe-day/content/locale/en.json";
import { islandHour, weatherAt } from "@wipe-day/domain/weather";
import { useEffect, useState } from "react";
import { wall } from "../state/clocks";
import { gameSeconds, useWorld } from "../state/store";
import { content, t } from "../state/world";
import { TICKER_SECONDS, tickerKeys, tickerPick } from "./tickerLines";

const KEYS = Object.keys((en as { ticker?: Record<string, string> }).ticker ?? {});
const HANDS = new Map(content.lines.map((line) => [line.id, line.hand]));

/**
 * The news ticker (12-feel.md 9.4): one line under the dock on desktop, in the drawer's handle
 * on a phone. A new line every 9 s of real time (an active timer: the wall clock, rule 6.3.9);
 * the weather and the hour come from the game clock, like the sky.
 */
export function Ticker() {
  const base = useWorld((state) => state.base);
  const [slot, setSlot] = useState(() => Math.floor(wall.nowMs() / 1000 / TICKER_SECONDS));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlot(Math.floor(wall.nowMs() / 1000 / TICKER_SECONDS));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!base) return null;
  const now = gameSeconds();
  const lines = tickerKeys(KEYS, base, weatherAt(content, now), islandHour(content, now), HANDS);
  const key = tickerPick(lines, slot);
  if (!key) return <p className="ticker" />;
  return (
    <p className="ticker" aria-live="off">
      <span key={`${slot}:${key}`} className="ticker-line">
        {t(key)}
      </span>
    </p>
  );
}
