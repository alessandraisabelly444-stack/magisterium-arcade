import { useMemo } from "react";

import axolotlSprite from "@/assets/characters/axolotl.png";
import capybaraSprite from "@/assets/characters/capybara.png";

import type { PlayableCharacterId } from "../../types";
import { getAnimation, getGameplaySprite } from "./characterSprites";
import { getFootAnchorCorrection } from "./footAnchor";
import type { AnimationState, EyePose, LegPose, PaletteKey } from "./types";
import { useSpriteAnimation } from "./useSpriteAnimation";

interface GameplaySpriteProps {
  characterId: PlayableCharacterId;
  animation?: AnimationState;
  /** Rendered size in px (sprite is 16x16 pixels). */
  size?: number;
  facing?: "right" | "left";
  /** Direction the authored sprite art faces before applying the requested facing. */
  sourceFacing?: "right" | "left";
  /** Align the lowest rendered foot pixel with the SVG baseline. */
  footAnchored?: boolean;
  className?: string;
}

const GRID = 16;
const FOOT_BASE_Y = 16;

function legOffsets(pose: LegPose): [number, number, number, number] {
  // [leftDx, rightDx, leftHeight, rightHeight]
  switch (pose) {
    case "stepA":
      return [-1, 1, 2, 1];
    case "stepB":
      return [1, -1, 1, 2];
    case "tuck":
      return [0, 0, 1, 1];
    case "spread":
      return [-1, 1, 2, 2];
    case "down":
      return [0, 0, 1, 1];
    default:
      return [0, 0, 2, 2];
  }
}

function eyeColor(pose: EyePose, key: PaletteKey, palette: Record<PaletteKey, string>) {
  if (key !== "e") return palette[key];
  if (pose === "closed" || pose === "happy") return palette.o;
  if (pose === "hurt") return "#ffffff";
  return palette.e;
}

export function GameplaySprite({
  characterId,
  animation = "idle",
  size = 96,
  facing = "right",
  sourceFacing = "right",
  footAnchored = false,
  className,
}: GameplaySpriteProps) {
  const sprite = getGameplaySprite(characterId);
  const shouldFlipX = facing !== sourceFacing;
  const anim = useMemo(() => getAnimation(characterId, animation), [characterId, animation]);
  const frame = useSpriteAnimation(anim) ?? {};
  const eyes = frame.eyes ?? "open";

  const bodyPixels = useMemo(() => {
    const out: { x: number; y: number; key: PaletteKey }[] = [];
    sprite?.grid.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== ".") out.push({ x, y, key: ch as PaletteKey });
      }),
    );
    return out;
  }, [sprite]);

  const [ldx, rdx, lh, rh] = legOffsets(frame.legs ?? "stand");
  const [lx, rx] = sprite?.legColumns ?? [0, 0];
  const legs = [
    { x: lx + ldx, h: lh },
    { x: rx + rdx, h: rh },
  ];

  const scaleY = frame.scaleY ?? 1;
  const footPixelLegs = legs.map((leg) => ({ x: leg.x, height: leg.h }));
  const footCorrection = footAnchored
    ? getFootAnchorCorrection(footPixelLegs, frame, FOOT_BASE_Y)
    : 0;
  const transform = [
    `translate(${frame.dx ?? 0} ${(frame.dy ?? 0) + footCorrection})`,
    `rotate(${frame.rotate ?? 0} 8 13)`,
    `translate(8 16) scale(${frame.scaleX ?? 1} ${scaleY}) translate(-8 -16)`,
  ].join(" ");

  if (!sprite) {
    const image = characterId === "calm-capybara-mage" ? capybaraSprite : axolotlSprite;
    return (
      <img
        src={image}
        alt={characterId}
        width={size}
        height={footAnchored ? size : (size * (GRID + 10)) / (GRID + 8)}
        className={className}
        style={{
          imageRendering: "pixelated",
          objectFit: "contain",
          transform: shouldFlipX ? "scaleX(-1)" : undefined,
          overflow: "visible",
        }}
        role="img"
        aria-label={`${characterId} ${animation}`}
      />
    );
  }

  return (
    <svg
      viewBox={
        footAnchored ? `-4 -8 ${GRID + 8} ${FOOT_BASE_Y + 8}` : `-4 -8 ${GRID + 8} ${GRID + 10}`
      }
      width={size}
      height={footAnchored ? size : (size * (GRID + 10)) / (GRID + 8)}
      shapeRendering="crispEdges"
      className={className}
      style={{ transform: shouldFlipX ? "scaleX(-1)" : undefined, overflow: "visible" }}
      role="img"
      aria-label={`${characterId} ${animation}`}
    >
      <ellipse
        cx={8}
        cy={footAnchored ? 15.2 : 16.4}
        rx={5}
        ry={0.8}
        fill="#1e2a5a"
        opacity={0.25}
      />
      <g transform={transform}>
        {legs.map((leg, i) => (
          <g key={i}>
            <rect x={leg.x} y={14} width={2} height={leg.h} fill={sprite.palette.o} />
            {leg.h === 2 && (
              <rect x={leg.x + 0.25} y={14} width={1.5} height={1} fill={sprite.palette.a} />
            )}
          </g>
        ))}
        {bodyPixels.map((p) => (
          <rect
            key={`${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={1.02}
            height={1.02}
            fill={eyeColor(eyes, p.key, sprite.palette)}
          />
        ))}
        {frame.fx === "flash" && (
          <rect x={0} y={0} width={16} height={14} fill="#ffffff" opacity={0.45} />
        )}
      </g>
      {frame.fx === "sparkle" &&
        (
          [
            [-2, -2],
            [15, -1],
            [-1, 8],
            [16, 6],
          ] as const
        ).map(([x, y]) => (
          <rect
            key={`${x}${y}`}
            x={x}
            y={y + (frame.dy ?? 0)}
            width={1}
            height={1}
            fill={sprite.palette.m}
          />
        ))}
      {frame.fx === "stars" &&
        (
          [
            [4, 6],
            [8, 5],
            [12, 6],
          ] as const
        ).map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width={1} height={1} fill="#b8f4ff" />
        ))}
    </svg>
  );
}
