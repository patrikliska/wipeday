/**
 * The yard's props (D246): the barrel, the car, the lamp and the rock from the Scene Mock,
 * standing in the gaps between the lines (`yard.props`), each sorted into depth by its feet
 * line like everything else in the camp. A lamp's bulb glows at night on the `lights` layer.
 */
import type { Container } from "pixi.js";
import { Glow } from "./effects";
import { stageSpot } from "./island";
import { ART, artSprite } from "./pixel";
import type { YardProp } from "./yards";

/** A lamp's warm light (the house window's colour) and its size (stage units). */
const LAMP = { color: 0xffc46b, size: 13 * ART, strength: 0.85 } as const;

/**
 * Adds each prop's sprite to `layer`, standing on `ground` (the stage's ground line), and each
 * lamp's glow to `lights`. Returns the glows, for the scene to light with the darkness.
 */
export function placeProps(
  layer: Container,
  lights: Container,
  ground: number,
  props: readonly YardProp[],
): Glow[] {
  const glows: Glow[] = [];
  for (const prop of props) {
    const sprite = artSprite(`prop/${prop.id}`);
    if (!sprite) continue;
    const spot = stageSpot(prop);
    if (prop.mirror) sprite.scale.x *= -1;
    sprite.position.set(spot.x, ground + spot.y);
    sprite.zIndex = ground + spot.y - 1;
    layer.addChild(sprite);
    if (prop.light) {
      const glow = new Glow(LAMP.color, LAMP.size, LAMP.strength);
      glow.sprite.position.set(spot.x + prop.light.x * ART, ground + spot.y - prop.light.y * ART);
      lights.addChild(glow.sprite);
      glows.push(glow);
    }
  }
  return glows;
}
