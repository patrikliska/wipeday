/**
 * The feed (W4b): what everyone on the island is up to, newest first, and this
 * player's notification settings: which kinds may ping them, and whether this
 * device gets them. Permission is asked only on the player's tap.
 */
import { type FeedItem, NOTIFY_KINDS, type NotifyKind } from "@wipe-day/domain/feed";
import { useEffect, useState } from "react";
import type { NotifySettings } from "../../net/backend";
import { currentSubscription, disablePush, enablePush, pushSupport } from "../../net/push";
import { feedLine } from "../../state/messages";
import { currentBackend, type FeedTab, useWorld } from "../../state/store";
import { duration, initials, t } from "../../state/world";
import { HallPanel, LegacyPanel } from "./Legacy";
import { RanksPanel } from "./Ranks";

const FEED_TABS: FeedTab[] = ["feed", "ranks", "legacy", "hall"];

/** The island: what everyone is up to, and who leads (W5). */
export function IslandPanel() {
  const tab = useWorld((state) => state.feedTab);
  const setTab = useWorld((state) => state.setFeedTab);
  return (
    <>
      <div className="tabs" role="tablist">
        {FEED_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(`feed.tab_${id}`)}
          </button>
        ))}
      </div>
      {tab === "feed" ? <FeedPanel /> : null}
      {tab === "ranks" ? <RanksPanel /> : null}
      {tab === "legacy" ? <LegacyPanel /> : null}
      {tab === "hall" ? <HallPanel /> : null}
    </>
  );
}

export function FeedPanel() {
  const feed = useWorld((state) => state.feed);
  const more = useWorld((state) => state.feedMore);
  const loadFeed = useWorld((state) => state.loadFeed);
  const markFeedSeen = useWorld((state) => state.markFeedSeen);
  const me = useWorld((state) => state.player?.id ?? 0);
  const now = useWorld((state) => Math.floor(state.now / 60) * 60);

  // Looking at the feed is reading it: the dot goes out (also for items arriving meanwhile).
  useEffect(() => {
    if (feed.length > 0) markFeedSeen();
  }, [feed, markFeedSeen]);

  return (
    <>
      <p className="hint">{t("feed.hint")}</p>
      {feed.length === 0 ? <p className="hint">{t("feed.empty")}</p> : null}
      <div className="feed">
        {feed.map((item) => (
          <FeedRow key={item.id} item={item} mine={item.playerId === me} now={now} />
        ))}
      </div>
      {more ? (
        <button type="button" className="btn small" onClick={() => void loadFeed(true)}>
          {t("feed.older")}
        </button>
      ) : null}
      <Notifications />
    </>
  );
}

function FeedRow({ item, mine, now }: { item: FeedItem; mine: boolean; now: number }) {
  const who = mine ? t("feed.you") : item.playerName;
  return (
    <div className={`feed-row${mine ? " mine" : ""}`}>
      <span className="who-tile">{mine ? t("hud.you") : initials(item.playerName)}</span>
      <div className="grow">
        <span className="line">{feedLine(item.event, who)}</span>
        <span className="when">
          {t("feed.ago", { time: duration(Math.max(60, now - item.at)) })}
        </span>
      </div>
    </div>
  );
}

function Notifications() {
  const mode = useWorld((state) => state.mode);
  const [settings, setSettings] = useState<NotifySettings | null>(null);
  const [onHere, setOnHere] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const support = pushSupport();

  useEffect(() => {
    if (mode !== "server") return;
    void currentBackend()
      .notify()
      .then(setSettings)
      .catch(() => setSettings(null));
    void currentSubscription()
      .then((subscription) => setOnHere(subscription !== null))
      .catch(() => setOnHere(false));
  }, [mode]);

  if (mode !== "server") {
    return (
      <>
        <h3 className="section">{t("feed.notifications")}</h3>
        <p className="hint">{t("feed.demo")}</p>
      </>
    );
  }

  const toggleKind = async (kind: NotifyKind, value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, prefs: { ...settings.prefs, [kind]: value } });
    try {
      const prefs = await currentBackend().setNotify({ [kind]: value });
      setSettings((current) => (current ? { ...current, prefs } : current));
    } catch {
      setSettings(settings);
    }
  };

  const device = async (on: boolean) => {
    if (!settings) return;
    setBusy(true);
    try {
      if (on) setOnHere(await enablePush(currentBackend(), settings.publicKey));
      else {
        await disablePush(currentBackend());
        setOnHere(false);
      }
    } catch {
      setOnHere(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3 className="section">{t("feed.notifications")}</h3>
      {support === "ios_home_screen" ? <p className="hint">{t("feed.ios")}</p> : null}
      {support === "unsupported" ? <p className="hint">{t("feed.unsupported")}</p> : null}
      {support === "denied" ? <p className="warn">{t("feed.denied")}</p> : null}
      {support === "ok" && onHere !== null ? (
        <div className="row">
          <span className="hint grow">{onHere ? t("feed.device_on") : t("feed.device_off")}</span>
          <button
            type="button"
            className={`btn small${onHere ? "" : " primary"}`}
            disabled={busy || !settings}
            onClick={() => void device(!onHere)}
          >
            {onHere ? t("feed.turn_off") : t("feed.turn_on")}
          </button>
        </div>
      ) : null}
      {settings ? (
        <div className="toggles">
          {NOTIFY_KINDS.map((kind) => (
            <label key={kind} className="toggle">
              <input
                type="checkbox"
                checked={settings.prefs[kind]}
                onChange={(event) => void toggleKind(kind, event.target.checked)}
              />
              <span className="grow">
                <b>{t(`feed.kind_${kind}`)}</b>
                <span className="sub">{t(`feed.kind_${kind}_sub`)}</span>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </>
  );
}
