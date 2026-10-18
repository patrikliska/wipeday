/**
 * `data/sounds.json5`, validated on start like the rest of the content: a cue an event names
 * must exist for every value its template can take (every era's target, every airdrop kind,
 * every UI action). Throws on bad data, so a broken map never ships quietly.
 */
import soundsFile from "@wipe-day/content/data/sounds.json5";
import { checkSounds, type Sounds } from "@wipe-day/content/sounds";
import type { UiAction } from "../state/events";
import { content } from "../state/world";

const UI_ACTIONS: readonly UiAction[] = ["open", "close", "switch"];

/** What each `{field}` of a cue template can be. */
export const TEMPLATE_VALUES: Record<string, readonly string[]> = {
  target: content.targets.map((target) => target.id),
  kind: content.flotsam.kinds.map((kind) => kind.id),
  action: UI_ACTIONS,
};

function load(): Sounds {
  const { sounds, problems } = checkSounds(soundsFile, TEMPLATE_VALUES);
  if (!sounds || problems.length > 0)
    throw new Error(`sounds.json5 is not valid:\n${problems.join("\n")}`);
  return sounds;
}

export const sounds: Sounds = load();
