import { useWorld } from "../state/store";
import { outputName, t } from "../state/world";
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
  const openDen = useWorld((state) => state.openDen);
  const openRecipe = useWorld((state) => state.openRecipe);
  const openReport = useWorld((state) => state.openReport);
  const dismiss = useWorld((state) => state.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" style={vars({ "--tone": TONE[toast.tone] })}>
          {toast.text}
          {toast.report ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (toast.report) openReport(toast.report);
                dismiss(toast.id);
              }}
            >
              {t("map.read_report")}
            </button>
          ) : toast.panel ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                if (toast.recipe) openRecipe(toast.recipe);
                else if (toast.panel === "den") openDen();
                else if (toast.panel) openPanel(toast.panel);
                dismiss(toast.id);
              }}
            >
              {toast.recipe
                ? t("craft.make_named", { item: outputName(toast.recipe) })
                : t(`panel.${toast.panel}`)}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
