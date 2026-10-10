import type { NotifyPrefs } from "@wipe-day/domain/feed";
import { eraOpen } from "@wipe-day/domain/lines";
import { nextEra } from "@wipe-day/domain/shelf";
import { type ReactNode, useEffect, useState } from "react";
import type { NotifyView } from "../net/backend";
import { currentSubscription, disablePush, enablePush, pushSupport } from "../net/push";
import { haptics, sound } from "../sound/audio";
import { useColumn } from "../state/layout";
import { currentBackend, useWorld } from "../state/store";
import { type Motion, type Panel, useUi } from "../state/ui";
import { content, crewName, lineName, t, tierName } from "../state/world";
import { Icon } from "./Icon";
import { tierVar, vars } from "./util";

/**
 * Panels (08-screens.md 1.8): Crew and Settings sit between the top bar and the nav row on a
 * phone and replace the shop inside the desktop column. Each closes by its (x), by Island, by
 * Escape and by Android back, and has one primary: Done.
 */
export function Panels() {
  const panel = useUi((state) => state.panel);
  const column = useColumn();
  if (!panel || column) return null;
  return (
    <section
      className="glass panel"
      aria-label={t(panel === "crew" ? "crew_panel.title" : "settings.title")}
    >
      <PanelBody panel={panel} />
    </section>
  );
}

export function PanelBody({ panel }: { panel: Panel }) {
  return panel === "crew" ? <CrewPanel /> : <SettingsPanel />;
}

function Shell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const openPanel = useUi((state) => state.openPanel);
  const close = () => {
    sound.play("ui_close");
    openPanel(null);
  };
  return (
    <div className="panel-body">
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        <button
          type="button"
          className="btn icon-btn"
          onClick={close}
          aria-label={t("settings.close")}
        >
          <Icon kind="ui" id="close" size={18} />
        </button>
      </header>
      <div className="panel-scroll">{children}</div>
      <footer className="panel-foot">
        <button type="button" className="btn primary grow" onClick={close}>
          {t("settings.done")}
        </button>
      </footer>
    </div>
  );
}

/** The roster (08-screens.md 2.3; R1: who is on shift, no ranks yet). */
function CrewPanel() {
  const base = useWorld((state) => state.base);
  if (!base) return null;
  const next = nextEra(content, base);
  // Hands of the eras reached, then the next era's (their lines show locked in the shop).
  const shown = content.lines.filter(
    (line) => eraOpen(base, line) || (next && line.era === next.id && !next.requires),
  );
  const on = shown.filter((line) => base.run.hands.includes(line.id)).length;
  return (
    <Shell title={t("crew_panel.title")} sub={t("crew_panel.summary", { on, total: shown.length })}>
      <ul className="crew-list">
        {shown.map((line) => {
          const hired = base.run.hands.includes(line.id);
          const open = eraOpen(base, line);
          const owned = base.run.lines[line.id] ?? 0;
          const status = !open
            ? t("crew_panel.opens_in", { era: tierName(line.era) })
            : hired
              ? t("crew_panel.on_shift")
              : owned > 0
                ? t("crew_panel.not_hired")
                : t("crew_panel.waiting", { line: lineName(line.id) });
          return (
            <li
              key={line.id}
              className={`crew-row${hired ? " on" : ""}${open ? "" : " locked"}`}
              style={vars({ "--tier-color": tierVar(line.era) })}
            >
              <span className="portrait">
                <Icon kind="crew" id={line.hand} size={40} />
              </span>
              <span className="crew-text">
                <span className="crew-name">
                  {t("crew_panel.line", { name: crewName(line.hand), line: lineName(line.id) })}
                </span>
                <span className={`crew-status${hired ? " on" : ""}`}>{status}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function Toggle({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`switch${on ? " on" : ""}`}
      onClick={() => {
        sound.play("ui_toggle");
        onChange(!on);
      }}
    >
      <span className="knob" />
      <span className="switch-text">{on ? t("settings.on") : t("settings.off")}</span>
    </button>
  );
}

function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ id: T; text: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <fieldset className="segments small">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          className={`segment${value === option.id ? " on" : ""}`}
          onClick={() => {
            if (value === option.id) return;
            sound.play("ui_toggle");
            onChange(option.id);
          }}
        >
          {option.text}
        </button>
      ))}
    </fieldset>
  );
}

/** Settings (08-screens.md 2.15): sound, numbers, motion, notifications, account, help. */
function SettingsPanel() {
  const scientific = useUi((state) => state.scientific);
  const setScientific = useUi((state) => state.setScientific);
  const motion = useUi((state) => state.motion);
  const setMotion = useUi((state) => state.setMotion);
  const player = useWorld((state) => state.player);
  const mode = useWorld((state) => state.mode);
  const [soundOn, setSoundOn] = useState(sound.enabled);
  const [volume, setVolume] = useState(sound.volume);
  const [buzz, setBuzz] = useState(haptics.enabled);
  const [how, setHow] = useState(false);

  return (
    <Shell title={t("settings.title")}>
      <div className="settings">
        <div className="setting">
          <span>{t("settings.sound")}</span>
          <Toggle
            on={soundOn}
            label={t("settings.sound")}
            onChange={(on) => {
              sound.setEnabled(on);
              setSoundOn(on);
            }}
          />
        </div>
        <label className="setting">
          <span>{t("settings.volume")}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            disabled={!soundOn}
            onChange={(event) => {
              const next = Number(event.target.value) / 100;
              sound.setVolume(next);
              setVolume(next);
            }}
          />
        </label>
        {haptics.supported ? (
          <div className="setting">
            <span>{t("settings.vibration")}</span>
            <Toggle
              on={buzz}
              label={t("settings.vibration")}
              onChange={(on) => {
                haptics.setEnabled(on);
                setBuzz(on);
              }}
            />
          </div>
        ) : null}
        <div className="setting stacked">
          <span>{t("settings.numbers")}</span>
          <Choice
            label={t("settings.numbers")}
            value={scientific ? "sci" : "short"}
            options={[
              { id: "short", text: t("settings.numbers_short") },
              { id: "sci", text: t("settings.numbers_sci") },
            ]}
            onChange={(value) => setScientific(value === "sci")}
          />
        </div>
        <div className="setting stacked">
          <span>{t("settings.motion")}</span>
          <Choice<Motion>
            label={t("settings.motion")}
            value={motion}
            options={[
              { id: "device", text: t("settings.motion_device") },
              { id: "reduced", text: t("settings.motion_reduced") },
              { id: "full", text: t("settings.motion_full") },
            ]}
            onChange={setMotion}
          />
        </div>
        <Notifications demo={mode === "demo"} />
        {player && mode === "server" ? (
          <div className="setting">
            <span className="who">{player.name}</span>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void currentBackend()
                  .logout()
                  .finally(() => window.location.reload());
              }}
            >
              {t("settings.logout")}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className="btn ghost fold"
          aria-expanded={how}
          onClick={() => setHow(!how)}
        >
          {t("settings.how")}
          <Icon kind="ui" id="chevron" size={16} className={how ? "up" : "down"} />
        </button>
        {how ? (
          <ol className="how">
            {["how_1", "how_2", "how_3", "how_4", "how_6"].map((key) => (
              <li key={key}>{t(`settings.${key}`)}</li>
            ))}
          </ol>
        ) : null}
      </div>
    </Shell>
  );
}

/**
 * Notifications on this device (08-screens.md 2.15): the device switch, then each kind. Kinds
 * ship with their systems: R1 has "Night Shift over" and quiet hours.
 */
function Notifications({ demo }: { demo: boolean }) {
  const [view, setView] = useState<NotifyView | null>(null);
  const [device, setDevice] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const support = typeof window === "undefined" ? "unsupported" : pushSupport();

  useEffect(() => {
    if (demo) return;
    let alive = true;
    void currentBackend()
      .notify()
      .then((answer) => alive && setView(answer))
      .catch(() => undefined);
    if (support === "ok")
      void currentSubscription().then((subscription) => alive && setDevice(subscription !== null));
    return () => {
      alive = false;
    };
  }, [demo, support]);

  const reason = demo
    ? t("settings.push_demo")
    : support === "ios_home_screen"
      ? t("settings.push_ios")
      : support === "unsupported"
        ? t("settings.push_unsupported")
        : support === "denied"
          ? t("settings.push_denied")
          : problem;

  const setPref = (change: Partial<NotifyPrefs>) => {
    if (!view) return;
    setView({ ...view, prefs: { ...view.prefs, ...change } });
    void currentBackend()
      .setNotify(change)
      .then((prefs) => setView((old) => (old ? { ...old, prefs } : old)))
      .catch(() => undefined);
  };
  const usable = !demo && support === "ok" && view !== null;

  return (
    <>
      <div className="setting">
        <span className="section">{t("settings.notifications")}</span>
        <Toggle
          on={device}
          disabled={!usable}
          label={t("settings.notifications")}
          onChange={(on) => {
            if (!view) return;
            const backend = currentBackend();
            if (on)
              void enablePush(backend, view.publicKey)
                .then((ok) => {
                  setDevice(ok);
                  setProblem(ok ? null : t("settings.push_failed"));
                })
                .catch(() => setProblem(t("settings.push_failed")));
            else void disablePush(backend).then(() => setDevice(false));
          }}
        />
      </div>
      {reason ? <p className="setting-note">{reason}</p> : null}
      <div className="setting">
        <span>
          {t("notify.night_shift_over")}
          <small>{t("settings.notify_night_shift_over")}</small>
        </span>
        <Toggle
          on={view?.prefs.night_shift_over ?? true}
          disabled={!usable}
          label={t("notify.night_shift_over")}
          onChange={(on) => setPref({ night_shift_over: on })}
        />
      </div>
      <div className="setting">
        <span>
          {t("settings.quiet")}
          <small>{t("settings.quiet_sub")}</small>
        </span>
        <Toggle
          on={view?.prefs.quiet ?? true}
          disabled={!usable}
          label={t("settings.quiet")}
          onChange={(on) => setPref({ quiet: on })}
        />
      </div>
    </>
  );
}
