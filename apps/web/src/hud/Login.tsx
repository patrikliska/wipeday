import { useWorld } from "../state/store";
import { t } from "../state/world";

/** Over the living scene: log in (one primary button), or say the server cannot be reached. */
export function Login() {
  const phase = useWorld((state) => state.phase);
  const config = useWorld((state) => state.config);
  const devLogin = useWorld((state) => state.devLogin);
  const failed = new URLSearchParams(window.location.search).get("login") === "failed";
  if (phase !== "login" && phase !== "offline") return null;

  if (phase === "offline") {
    return (
      <div className="modal-backdrop">
        <div className="glass modal login" role="dialog" aria-labelledby="login-title">
          <h2 id="login-title">{t("login.offline_title")}</h2>
          <p>{t("login.offline")}</p>
          <div className="row">
            <button
              type="button"
              className="btn primary grow"
              onClick={() => window.location.reload()}
            >
              {t("login.retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="glass modal login" role="dialog" aria-labelledby="login-title">
        <h2 id="login-title">{t("login.title")}</h2>
        <p>{t("login.pitch")}</p>
        {failed ? <p className="line warn">{t("login.failed")}</p> : null}
        <div className="row">
          {config.discordLogin ? (
            <a className="btn primary grow" href="/api/auth/discord">
              {t("login.discord")}
            </a>
          ) : (
            <button type="button" className="btn grow" disabled>
              {t("login.discord_unavailable")}
            </button>
          )}
        </div>
        {config.devLogin ? (
          <>
            <p className="hint">{t("login.dev_hint")}</p>
            <div className="row">
              {[1, 2, 3].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="btn grow"
                  onClick={() => void devLogin(slot)}
                >
                  {t("login.dev_player", { slot })}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
