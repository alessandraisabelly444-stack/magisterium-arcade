export interface FootPixelLeg {
  x: number;
  height: number;
}

export interface SpriteFrameTransform {
  dy?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
}

const SCALE_ORIGIN_X = 8;
const SCALE_ORIGIN_Y = 16;
const ROTATION_ORIGIN_X = 8;
const ROTATION_ORIGIN_Y = 13;

/** Apply the same SVG scale/rotation/translation order used by GameplaySprite to a foot pixel. */
export function transformFootPixelY(x: number, y: number, frame: SpriteFrameTransform) {
  const scaledX = SCALE_ORIGIN_X + (x - SCALE_ORIGIN_X) * (frame.scaleX ?? 1);
  const scaledY = SCALE_ORIGIN_Y + (y - SCALE_ORIGIN_Y) * (frame.scaleY ?? 1);
  const radians = ((frame.rotate ?? 0) * Math.PI) / 180;
  return (
    ROTATION_ORIGIN_Y +
    (scaledX - ROTATION_ORIGIN_X) * Math.sin(radians) +
    (scaledY - ROTATION_ORIGIN_Y) * Math.cos(radians) +
    (frame.dy ?? 0)
  );
}

/** Return the vertical SVG translation that keeps the lowest foot pixel on a shared baseline. */
export function getFootAnchorCorrection(
  legs: FootPixelLeg[],
  frame: SpriteFrameTransform,
  baselineY = 16,
) {
  const lowestFootY = Math.max(
    ...legs.map((leg) => transformFootPixelY(leg.x, 14 + leg.height, frame)),
  );
  return baselineY - lowestFootY;
}
