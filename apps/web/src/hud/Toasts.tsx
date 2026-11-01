import { useWorld } from "../state/store";
import { vars } from "./util";

const TONE = {
  neutral: "var(--muted)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

/** One-line notes under the top bar, two at most: refusals with their one button, the connection. */
export function Toasts() {
  const toasts = useWorld((state) => state.toasts);
  const dismiss = useWorld((state) => state.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" style={vars({ "--tone": TONE[toast.tone] })}>
          <span className="toast-text">{toast.text}</span>
          {toast.action ? (
            <button
              type="button"
              className="btn toast-btn"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
