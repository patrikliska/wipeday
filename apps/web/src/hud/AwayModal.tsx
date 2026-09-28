import { total } from "@wipe-day/domain/base";
import type { GameEvent } from "@wipe-day/domain/events";
import { useWorld } from "../state/store";
import { abbrev, duration, itemName, resourceName, t, tierName } from "../state/world";
import { pendingOf } from "./derived";
import { ResourceIcon } from "./Icon";

const NOTHING: Record<string, number> = {};

/** One line per kind of thing that happened while away, most important first. */
function summary(events: GameEvent[]): string[] {
  const lines: string[] = [];
  for (const event of events) {
    if (event.type === "build_done")
      lines.push(t("welcome.build_done", { tier: tierName(event.tier) }));
    if (event.type === "decayed") lines.push(t("welcome.decayed", { tier: tierName(event.to) }));
  }
  const crafted = events.filter((event) => event.type === "crafted");
  if (crafted.length > 0) {
    const names = [...new Set(crafted.map((event) => itemName(event.item)))].join(", ");
    lines.push(t("welcome.crafted", { items: names }));
  }
  const barrels = events.filter((event) => event.type === "barrel_spawned").length;
  if (barrels > 0) lines.push(t("welcome.barrels", { count: barrels }));
  const upkeep = events.filter((event) => event.type === "upkeep_paid");
  const hours = upkeep.reduce((sum, event) => sum + event.hours, 0);
  if (hours > 0) lines.push(t("welcome.upkeep", { hours }));
  return lines;
}

/** What happened while the player was gone, and one button to bank what piled up. */
export function AwayModal() {
  const welcome = useWorld((state) => state.welcomeBack);
  // `pendingOf` returns the same object within a second, so this selector is stable.
  const waiting = useWorld((state) => (state.welcomeBack ? pendingOf(state) : NOTHING));
  const dismiss = useWorld((state) => state.dismissWelcome);
  const collect = useWorld((state) => state.collect);
  if (!welcome) return null;
  const lines = summary(welcome.events);
  const pending = Object.entries(waiting)
    .map(([id, amount]) => [id, Math.floor(amount)] as const)
    .filter(([, amount]) => amount >= 1)
    .sort((a, b) => b[1] - a[1]);
  const hasPending = total(Object.fromEntries(pending)) > 0;

  return (
    <div className="modal-backdrop">
      <div className="glass modal" role="dialog" aria-labelledby="away-title">
        <h2 id="away-title">{t("welcome.title")}</h2>
        <p>{t("welcome.away", { time: duration(welcome.awaySeconds) })}</p>
        {lines.map((line) => (
          <p key={line} className="line">
            {line}
          </p>
        ))}
        {hasPending ? (
          <div className="gains">
            {pending.map(([id, amount]) => (
              <span key={id}>
                <ResourceIcon id={id} /> +{abbrev(amount)} {resourceName(id)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="row">
          {hasPending ? (
            <>
              <button
                type="button"
                className="btn primary grow"
                onClick={() => {
                  collect();
                  dismiss();
                }}
              >
                {t("welcome.collect")}
              </button>
              <button type="button" className="btn" onClick={dismiss}>
                {t("welcome.leave")}
              </button>
            </>
          ) : (
            <button type="button" className="btn primary grow" onClick={dismiss}>
              {t("welcome.continue")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
