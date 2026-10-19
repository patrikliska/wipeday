/**
 * The yard's props (P3 mocks): the barrel, the car, the lamp and the rock from the Scene Mock,
 * standing in the gaps between the lines (`yard.props`), each sorted into depth by its feet
 * line like everything else in the camp. The flat camp has none.
 */
import type { Container } from "pixi.js";
import { stageSpot } from "./island";
import { artSprite } from "./pixel";
import type { YardProp } from "./yards";

/** Adds each prop's sprite to `layer`, standing on `ground` (the stage's ground line). */
export function placeProps(layer: Container, ground: number, props: readonly YardProp[]): void {
  for (const prop of props) {
    const sprite = artSprite(`prop/${prop.id}`);
    if (!sprite) continue;
    const spot = stageSpot(prop);
    if (prop.mirror) sprite.scale.x *= -1;
    sprite.position.set(spot.x, ground + spot.y);
    sprite.zIndex = ground + spot.y - 1;
    layer.addChild(sprite);
  }
}
