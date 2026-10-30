import { useEffect, useState } from "react";
import { useBigRed } from "../state/bigred";
import { wall } from "../state/clocks";
import { useWorld } from "../state/store";
import { t } from "../state/world";

/*
 * The film's HUD side (docs/redesign/03-the-big-red.md 7; D270): the scene draws everything
 * (`scene/cinematic.ts`); this layer holds the white flash (a CSS overlay reading `--flash`,
 * which the scene writes every frame), the Skip button from Wipe Day #2 (fading in after
 * 400 ms; only the button skips, so a nervous thumb cannot skip the first launch), and the
 * "Saving…" mark while the press waits for the server's answer.
 */
export function Cinematic() {
  const film = useBigRed((state) => state.film);
  const skip = useBigRed((state) => state.skipFilm);
  const saving = useWorld((state) => state.queue.some((entry) => entry.command.type === "nuke"));
  const [skipShown, setSkipShown] = useState(false);
  useEffect(() => {
    if (!film) {
      setSkipShown(false);
      return;
    }
    const left = Math.max(0, 400 - (wall.nowMs() - film.startedMs));
    const timer = window.setTimeout(() => setSkipShown(true), left);
    return () => window.clearTimeout(timer);
  }, [film]);
  if (!film) return null;
  return (
    <div className="film-layer">
      <div className="flash" aria-hidden="true" />
      {film.skippable && skipShown ? (
        <button type="button" className="btn secondary film-skip" onClick={skip}>
          {t("cinematic.skip")}
        </button>
      ) : null}
      {saving ? (
        <span className="film-saving" role="status">
          {t("big_red.saving")}
        </span>
      ) : null}
    </div>
  );
}
