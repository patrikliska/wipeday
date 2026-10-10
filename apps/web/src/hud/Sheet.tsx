import type { ReactNode } from "react";
import { t } from "../state/world";
import { Icon } from "./Icon";

/**
 * A sheet over everything (08-screens.md 1.8): a 55% dim, the card anchored at the bottom on a
 * phone and centred on wide screens, one primary at its foot. The backdrop is a button so
 * keyboards and readers reach it; `onClose` is what it and the (x) do. A card with no other way
 * out (welcome back) passes `closable={false}`: its backdrop then does what its button does.
 */
export function SheetFrame({
  id,
  className,
  title,
  head,
  primary,
  onPrimary,
  onClose,
  closable = true,
  children,
}: {
  id: string;
  className: string;
  title: string;
  /** Under the title: a sub line or a big figure. */
  head?: ReactNode;
  primary: string;
  onPrimary: () => void;
  onClose: () => void;
  closable?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop">
      <button
        type="button"
        className="backdrop-hit"
        tabIndex={-1}
        aria-label={closable ? t("settings.close") : primary}
        onClick={onClose}
      />
      <section
        className={`glass sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
      >
        <header className="panel-head">
          <div>
            <h2 id={`${id}-title`}>{title}</h2>
            {head}
          </div>
          {closable ? (
            <button
              type="button"
              className="btn icon-btn"
              onClick={onClose}
              aria-label={t("settings.close")}
            >
              <Icon kind="ui" id="close" size={18} />
            </button>
          ) : null}
        </header>
        <div className="panel-scroll">{children}</div>
        <footer className="panel-foot">
          <button type="button" className="btn primary grow" onClick={onPrimary}>
            {primary}
          </button>
        </footer>
      </section>
    </div>
  );
}
