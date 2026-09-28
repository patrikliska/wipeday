import { useWorld } from "../state/store";
import { t } from "../state/world";
import { vars } from "./util";

const TONE = {
  neutral: "var(--muted)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

/** One-line notes; a refusal carries a button to where the missing thing comes from. */
export function Toasts() {
  const toasts = useWorld((state) => state.toasts);
  const openPanel = useWorld((state) => state.openPanel);
  const dismiss = useWorld((state) => state.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" style={vars({ "--tone": TONE[toast.tone] })}>
          {toast.text}
          {toast.panel ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (toast.panel) openPanel(toast.panel);
                dismiss(toast.id);
              }}
            >
              {t(`panel.${toast.panel}`)}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
