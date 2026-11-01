import { sounds } from "../sound/map";
import { useUi } from "../state/ui";
import { t } from "../state/world";
import { Icon } from "./Icon";
import { SheetFrame } from "./Sheet";

/**
 * The Credits sheet (D226; `docs/credits.md` holds the same lines): the type, the art and every
 * sound pack `data/sounds.json5` uses, each with its licence. Opened from Settings; read-only.
 */
export function Credits() {
  const sheet = useUi((state) => state.sheet);
  const openSheet = useUi((state) => state.openSheet);
  if (sheet !== "credits") return null;
  const close = () => openSheet(null);
  return (
    <SheetFrame
      id="credits"
      className="credits"
      title={t("credits.title")}
      head={<p className="sub">{t("credits.sub")}</p>}
      primary={t("settings.done")}
      onPrimary={close}
      onClose={close}
    >
      <h3 className="credits-head">{t("credits.fonts")}</h3>
      <ul className="credits-list">
        <Line name={t("credits.font_big_shoulders")} note={t("credits.font_licence")} />
        <Line name={t("credits.font_barlow")} note={t("credits.font_licence")} />
      </ul>
      <h3 className="credits-head">{t("credits.art")}</h3>
      <ul className="credits-list">
        <Line name={t("credits.art_scene")} />
      </ul>
      <h3 className="credits-head">{t("credits.sound")}</h3>
      <ul className="credits-list">
        {sounds.sources.map((source) => (
          <Line
            key={source.id}
            name={t(`credits.source.${source.id}`)}
            note={t(`credits.licence.${source.licence}`)}
            url={source.url}
          />
        ))}
      </ul>
      <p className="mult-note credits-voices">{t("credits.voices")}</p>
    </SheetFrame>
  );
}

/** One credit; with a `url` the whole row is the link (a 44 px target), its site on the right. */
function Line({ name, note, url }: { name: string; note?: string; url?: string }) {
  const text = (
    <span className="credits-text">
      <span className="credits-name">{name}</span>
      {note ? <span className="credits-note">{note}</span> : null}
    </span>
  );
  return (
    <li className="credits-row">
      {url ? (
        <a className="credits-link" href={url} target="_blank" rel="noreferrer">
          {text}
          <span className="credits-site">
            {new URL(url).hostname}
            <Icon kind="ui" id="chevron" size={14} />
          </span>
        </a>
      ) : (
        text
      )}
    </li>
  );
}
