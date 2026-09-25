import { useWorld } from "../state/store";
import { vars } from "./util";

const TONE = {
  neutral: "var(--muted)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;

export function Toasts() {
  const toasts = useWorld((state) => state.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" style={vars({ "--tone": TONE[toast.tone] })}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
