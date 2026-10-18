import type { IconKind } from "@wipe-day/content/icons";
import { BADGE_CHAPTERS, type BadgeDef } from "@wipe-day/content/schema";
import { badgeCount, badgeProgress, moraleOf } from "@wipe-day/domain/badges";
import type { BaseState } from "@wipe-day/domain/state";
import { useEffect, useRef } from "react";
import { useUi } from "../state/ui";
import { content, fmt, fmtFactor, t } from "../state/world";
import { Icon } from "./Icon";

/** A badge's icon as `<Icon>` wants it (`kind/id` in the data, D141). */
export function BadgeIcon({ badge, size }: { badge: BadgeDef; size: number }) {
  const [kind = "ui", id = "lock"] = badge.icon.split("/");
  return <Icon kind={kind as IconKind} id={id} size={size} />;
}

/** When a badge was earned, short ("18 Oct"). */
const earnedOn = (second: number): string =>
  new Date(second * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The Logbook (12-feel.md 9.1; D198, D239): the badge wall, opened from the dock. Chapters in a
 * fixed order and badges in the data's order, never resorted; every badge visible, earned ones
 * lit with their date, locked ones with what earns them and a bar when they count something.
 * The head says how many and what they are worth in Morale. Badges new since the Logbook last
 * showed carry a "New" tag this once; opening it clears the dock's count.
 */
export function LogbookPanel({ base }: { base: BaseState }) {
  const earned = badgeCount(content, base);
  const seenAtOpen = useRef(useUi.getState().badgesSeen);
  useEffect(() => {
    useUi.getState().seeBadges(earned);
  }, [earned]);
  const all = content.achievements.badges;
  // The newest badges, as many as were earned since the last look.
  const fresh = new Set(
    all
      .filter((badge) => base.meta.badges[badge.id] !== undefined)
      .sort((a, b) => (base.meta.badges[b.id] ?? 0) - (base.meta.badges[a.id] ?? 0))
      .slice(0, Math.max(0, earned - seenAtOpen.current))
      .map((badge) => badge.id),
  );
  return (
    <div className="logbook">
      {BADGE_CHAPTERS.map((chapter) => {
        const badges = all.filter((badge) => badge.chapter === chapter);
        if (badges.length === 0) return null;
        const got = badges.filter((badge) => base.meta.badges[badge.id] !== undefined).length;
        return (
          <section key={chapter} className="logbook-chapter">
            <h3>
              <span>{t(`logbook.chapter.${chapter}`)}</span>
              <span className="num count">
                {t("logbook.chapter_count", { got, total: badges.length })}
              </span>
            </h3>
            <ul className="badge-grid">
              {badges.map((badge) => (
                <BadgeTile key={badge.id} badge={badge} base={base} fresh={fresh.has(badge.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function BadgeTile({ badge, base, fresh }: { badge: BadgeDef; base: BaseState; fresh: boolean }) {
  const at = base.meta.badges[badge.id];
  const earned = at !== undefined;
  const progress = earned ? null : badgeProgress(content, badge, base);
  const fill = progress ? Math.min(1, progress.value / progress.goal) : 0;
  return (
    <li className={`badge-tile${earned ? " earned" : " locked"}${fresh ? " fresh" : ""}`}>
      <span className="badge-icon">
        <BadgeIcon badge={badge} size={30} />
        {earned ? null : (
          <span className="badge-lock">
            <Icon kind="ui" id="lock" size={13} />
          </span>
        )}
      </span>
      <span className="badge-text">
        <span className="badge-name">{t(`badge.${badge.id}.name`)}</span>
        <span className="badge-how">{t(`badge.${badge.id}.how`)}</span>
        {earned ? (
          <span className="badge-when">{t("logbook.earned", { date: earnedOn(at) })}</span>
        ) : progress ? (
          <span className="badge-progress">
            <span className="badge-bar">
              <span className="badge-fill" style={{ transform: `scaleX(${fill})` }} />
            </span>
            <span className="num">
              {t("logbook.progress", {
                value: fmt(Math.min(progress.value, progress.goal)),
                goal: fmt(progress.goal),
              })}
            </span>
          </span>
        ) : null}
      </span>
      {fresh ? <span className="badge-new">{t("logbook.new")}</span> : null}
    </li>
  );
}

/** The Logbook's head line: "12 of 64 badges · Morale ×1.12". */
export function logbookSummary(base: BaseState): string {
  return t("logbook.summary", {
    got: badgeCount(content, base),
    total: content.achievements.badges.length,
    morale: fmtFactor(moraleOf(content, base)),
  });
}
