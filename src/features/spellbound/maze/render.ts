import axolotlImageUrl from "@/assets/characters/axolotl.png";
import capybaraImageUrl from "@/assets/characters/capybara.png";

import { getGameplaySprite } from "../gameplay/sprites/characterSprites";
import { MAZE_TILE_SIZE } from "./config";
import type { MazeBiomeDefinition, MazeCell, MazeSnapshot, MazeTile } from "./types";

const SIZE = MAZE_TILE_SIZE;
const characterImageCache = new Map<string, HTMLImageElement>();
const SPIRIT_PALETTES = {
  pursuer: { body: "#ff7fba", light: "#ffd3ea", eye: "#4f245f" },
  interceptor: { body: "#63d9f2", light: "#c8fbff", eye: "#17365b" },
  patroller: { body: "#b08aff", light: "#e6d6ff", eye: "#30215a" },
  trickster: { body: "#f3c66c", light: "#fff1b4", eye: "#5b3744" },
} as const;

function fillRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function fillScaledSpriteRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const left = Math.round(x);
  const top = Math.round(y);
  const right = Math.round(x + width);
  const bottom = Math.round(y + height);
  if (right <= left || bottom <= top) return;
  ctx.fillStyle = color;
  ctx.fillRect(left, top, right - left, bottom - top);
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  biome: MazeBiomeDefinition,
  x: number,
  y: number,
  time: number,
) {
  const left = x * SIZE;
  const top = y * SIZE;
  const alternate = (x * 7 + y * 11) % 5 === 0;
  fillRect(ctx, alternate ? biome.floorAlt : biome.floor, left, top, SIZE, SIZE);
  if ((x * 3 + y * 5) % 13 === 0) {
    const sparkle = Math.sin(time * 1.8 + x * 2.1 + y) > 0.82;
    fillRect(
      ctx,
      sparkle ? biome.accent : biome.glow,
      left + 7 + ((x + y) % 13),
      top + 8 + ((x * y) % 11),
      2,
      2,
    );
  }
  if ((x + 2 * y) % 17 === 0) {
    fillRect(ctx, biome.accent, left + 22, top + 24, 2, 2);
  }
}

function drawBlockWall(
  ctx: CanvasRenderingContext2D,
  biome: MazeBiomeDefinition,
  x: number,
  y: number,
  cracked = false,
) {
  const left = x * SIZE;
  const top = y * SIZE;
  fillRect(ctx, biome.wall, left, top, SIZE, SIZE);
  fillRect(ctx, biome.wallLight, left + 2, top + 2, SIZE - 4, 3);
  fillRect(ctx, "rgba(4, 9, 31, 0.34)", left + 2, top + SIZE - 5, SIZE - 4, 3);
  fillRect(ctx, "rgba(8, 13, 39, 0.25)", left + 3, top + 6, 2, SIZE - 12);
  fillRect(ctx, "rgba(255, 255, 255, 0.08)", left + 7, top + 8, SIZE - 14, 2);
  if (cracked) {
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left + 9, top + 7);
    ctx.lineTo(left + 18, top + 14);
    ctx.lineTo(left + 13, top + 19);
    ctx.lineTo(left + 23, top + 25);
    ctx.stroke();
    fillRect(ctx, biome.glow, left + 7, top + 6, 3, 3);
  }
}

function drawSpecial(
  ctx: CanvasRenderingContext2D,
  biome: MazeBiomeDefinition,
  x: number,
  y: number,
  time: number,
) {
  const left = x * SIZE;
  const top = y * SIZE;
  fillRect(ctx, biome.floorAlt, left, top, SIZE, SIZE);
  const pulse = Math.sin(time * 3.2 + x * 0.7 + y) > 0 ? 1 : 0;
  fillRect(ctx, biome.special, left + 13, top + 5 - pulse, 6, 3);
  fillRect(ctx, biome.special, left + 8, top + 11, 16, 5);
  fillRect(ctx, biome.glow, left + 12, top + 16, 8, 6);
  fillRect(ctx, biome.special, left + 10, top + 22 + pulse, 12, 3);
}

function drawGrid(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (let y = 0; y < snapshot.height; y += 1) {
    for (let x = 0; x < snapshot.width; x += 1) {
      const tile = snapshot.grid[y]?.[x] ?? "wall";
      if (tile === "wall") drawBlockWall(ctx, snapshot.biome, x, y);
      else if (tile === "breakable") drawBlockWall(ctx, snapshot.biome, x, y, true);
      else {
        drawFloor(ctx, snapshot.biome, x, y, time);
        if (tile === "special") drawSpecial(ctx, snapshot.biome, x, y, time);
      }
    }
  }
}

function drawSwampZones(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (const zone of snapshot.swampZones) {
    const fade = Math.max(0.12, zone.secondsRemaining / zone.maxSeconds);
    for (const cell of zone.cells) {
      const left = cell.x * SIZE;
      const top = cell.y * SIZE;
      ctx.save();
      ctx.globalAlpha = fade * 0.72;
      fillRect(ctx, "#285e4a", left + 2, top + 2, SIZE - 4, SIZE - 4);
      fillRect(ctx, "rgba(137, 224, 144, 0.58)", left + 5, top + 5, SIZE - 10, 3);
      fillRect(ctx, "rgba(13, 36, 38, 0.58)", left + 4, top + SIZE - 8, SIZE - 8, 4);
      if (Math.sin(time * 4 + cell.x * 1.3 + cell.y * 0.7) > 0.25) {
        fillRect(ctx, "#b4f0a5", left + 8 + ((cell.x + cell.y) % 12), top + 13, 3, 3);
        fillRect(ctx, "#72cf95", left + 18, top + 20 - ((cell.x * 3) % 5), 2, 2);
      }
      fillRect(ctx, "#c9f39b", left + 22, top + 8 + ((cell.y * 3) % 6), 3, 2);
      ctx.restore();
    }
  }
}

function drawTeleportTargets(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (const player of snapshot.players) {
    if (!player.teleportTarget) continue;
    const center = renderCellCenter(player.teleportTarget);
    const valid = player.teleportTargetValid;
    const pulse = 1 + Math.sin(time * 12) * 0.1;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = valid ? "rgba(108, 244, 213, 0.22)" : "rgba(255, 111, 141, 0.22)";
    ctx.fillRect(center.x - SIZE / 2 + 2, center.y - SIZE / 2 + 2, SIZE - 4, SIZE - 4);
    ctx.strokeStyle = valid ? "#77ffd6" : "#ff87a0";
    ctx.lineWidth = 2;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.strokeRect(
      center.x - (SIZE * pulse) / 2 + 3,
      center.y - (SIZE * pulse) / 2 + 3,
      SIZE * pulse - 6,
      SIZE * pulse - 6,
    );
    ctx.beginPath();
    ctx.moveTo(center.x - 9, center.y);
    ctx.lineTo(center.x + 9, center.y);
    ctx.moveTo(center.x, center.y - 9);
    ctx.lineTo(center.x, center.y + 9);
    ctx.stroke();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = valid ? "#caffee" : "#ffd4df";
    ctx.fillText(valid ? "ALVO OK" : "BLOQUEADO", center.x, center.y - 21);
    ctx.restore();
  }
}

function drawDiamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(x), Math.round(y - radius));
  ctx.lineTo(Math.round(x + radius * 0.65), Math.round(y - radius * 0.25));
  ctx.lineTo(Math.round(x + radius * 0.65), Math.round(y + radius * 0.25));
  ctx.lineTo(Math.round(x), Math.round(y + radius));
  ctx.lineTo(Math.round(x - radius * 0.65), Math.round(y + radius * 0.25));
  ctx.lineTo(Math.round(x - radius * 0.65), Math.round(y - radius * 0.25));
  ctx.closePath();
  ctx.fill();
}

function drawItems(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (const item of snapshot.items) {
    if (item.collectedBy) continue;
    const x = (item.x + 0.5) * SIZE;
    const y = (item.y + 0.5) * SIZE;
    const bob = Math.sin(time * 3.2 + item.x * 1.3 + item.y) * 2;
    ctx.save();
    ctx.shadowColor =
      item.kind === "crystal" ? "#7beaff" : item.kind === "power-rune" ? "#c77bff" : "#ffd98a";
    ctx.shadowBlur = item.kind === "power-rune" ? 16 : 12;
    if (item.kind === "crystal") {
      drawDiamond(ctx, x, y + bob, 10, "#8cefff");
      fillRect(ctx, "#f2ffff", x - 2, y - 5 + bob, 4, 8);
      fillRect(ctx, "#5298e7", x - 3, y + 6 + bob, 6, 3);
    } else if (item.kind === "coin") {
      fillRect(ctx, "#9d5c2f", x - 7, y - 8 + bob, 14, 16);
      fillRect(ctx, "#e9a83d", x - 5, y - 9 + bob, 10, 18);
      fillRect(ctx, "#ffdc75", x - 3, y - 6 + bob, 6, 12);
      fillRect(ctx, "#fff4bc", x - 2, y - 5 + bob, 2, 4);
    } else if (item.kind === "power-rune") {
      drawDiamond(ctx, x, y + bob, 12, "#a24be8");
      fillRect(ctx, "#f5e6ff", x - 2, y - 8 + bob, 4, 16);
      fillRect(ctx, "#8feeff", x - 7, y - 2 + bob, 14, 4);
      fillRect(ctx, "#ffffff", x - 1, y - 1 + bob, 2, 2);
    } else {
      fillRect(ctx, "#ffd887", x - 8, y - 8 + bob, 16, 16);
      fillRect(ctx, "#fff2bf", x - 5, y - 5 + bob, 10, 10);
      fillRect(ctx, "#9064d9", x - 2, y - 2 + bob, 4, 4);
      fillRect(ctx, "#fff7d4", x - 1, y - 7 + bob, 2, 14);
    }
    ctx.restore();
  }
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  biome: MazeBiomeDefinition,
  exit: MazeCell,
  open: boolean,
  time: number,
) {
  const x = (exit.x + 0.5) * SIZE;
  const y = (exit.y + 0.5) * SIZE;
  const pulse = 1 + Math.sin(time * 4) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = open ? "#fff4aa" : biome.glow;
  ctx.shadowBlur = open ? 22 : 10;
  ctx.fillStyle = open ? "#f2d37e" : biome.wall;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = open ? "#fff3bb" : biome.accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  fillRect(ctx, open ? "#fffbe5" : biome.floor, -4, -9, 8, 18);
  if (!open) {
    fillRect(ctx, biome.wallLight, -3, -2, 6, 7);
    fillRect(ctx, biome.accent, -6, -7, 12, 3);
  } else {
    fillRect(ctx, "#9a7be8", -1, -10, 2, 20);
  }
  ctx.restore();
}

function drawGlobalTimeStop(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  if (snapshot.globalTimeStopSeconds <= 0) return;
  const width = snapshot.width * SIZE;
  const height = snapshot.height * SIZE;
  ctx.save();
  ctx.globalAlpha = 0.1 + Math.sin(time * 2.4) * 0.025;
  ctx.fillStyle = "#7976cf";
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.78;
  for (let index = 0; index < 18; index += 1) {
    const x = (((index * 79 + Math.sin(time * 0.45 + index) * 18) % width) + width) % width;
    const y =
      (((index * 53 + Math.cos(time * 0.38 + index * 1.7) * 15) % height) + height) % height;
    fillRect(ctx, index % 3 === 0 ? "#fff8ff" : "#9eeeff", x, y, 2, 2);
    if (index % 6 === 0) {
      ctx.strokeStyle = "rgba(225, 218, 255, 0.88)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 5, y + 5, 3, 0, Math.PI * 2);
      ctx.stroke();
      fillRect(ctx, "#fffaff", x + 4, y + 3, 1, 3);
      fillRect(ctx, "#d8caff", x + 5, y + 5, 2, 1);
    }
  }
  ctx.restore();
}

function spiritColor(kind: keyof typeof SPIRIT_PALETTES) {
  return SPIRIT_PALETTES[kind];
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  ghost: MazeSnapshot["ghosts"][number],
  time: number,
) {
  const palette = spiritColor(ghost.kind);
  const x = ghost.x * SIZE;
  const y = ghost.y * SIZE;
  const flicker = Math.sin(time * 12 + x) * 0.5;
  const frozen = ghost.frozenSeconds > 0;
  const timeStopped = ghost.timeStoppedSeconds > 0;
  const disabled = frozen || timeStopped || ghost.stunnedSeconds > 0;
  ctx.save();
  ctx.globalAlpha = disabled ? 0.78 + flicker * 0.12 : 1;
  ctx.shadowColor = frozen
    ? "#8cefff"
    : timeStopped
      ? "#c5adff"
      : disabled
        ? "#fff1a8"
        : palette.body;
  ctx.shadowBlur = disabled ? 13 : 7;
  fillRect(ctx, "rgba(4, 9, 31, 0.35)", x - 10, y + 9, 20, 4);
  fillRect(ctx, palette.body, x - 8, y - 7, 16, 17);
  fillRect(ctx, palette.body, x - 6, y - 10, 12, 4);
  fillRect(ctx, palette.light, x - 4, y - 6, 8, 4);
  fillRect(ctx, palette.body, x - 11, y - 3, 3, 10);
  fillRect(ctx, palette.body, x + 8, y - 3, 3, 10);
  fillRect(ctx, palette.body, x - 8, y + 10, 5, 4);
  fillRect(
    ctx,
    palette.body,
    x - 1,
    y + 10 + (ghost.kind === "trickster" ? Math.round(flicker) : 0),
    5,
    4,
  );
  fillRect(ctx, palette.body, x + 6, y + 10, 4, 4);
  fillRect(ctx, palette.light, x - 5, y - 1, 3, 4);
  fillRect(ctx, palette.light, x + 3, y - 1, 3, 4);
  fillRect(ctx, palette.eye, x - 4, y, 2, 3);
  fillRect(ctx, palette.eye, x + 4, y, 2, 3);
  if (ghost.kind === "pursuer") {
    fillRect(ctx, "#fff1fa", x - 2, y - 13, 4, 3);
    fillRect(ctx, palette.body, x - 1, y - 16, 2, 3);
  } else if (ghost.kind === "interceptor") {
    drawDiamond(ctx, x, y - 12, 5, palette.light);
  } else if (ghost.kind === "patroller") {
    fillRect(ctx, "#d6ffb8", x - 2, y - 13, 4, 3);
    fillRect(ctx, "#76ce9d", x - 1, y - 16, 2, 3);
  } else {
    fillRect(ctx, "#fff2ad", x - 6, y - 13, 3, 3);
    fillRect(ctx, "#fff2ad", x + 3, y - 13, 3, 3);
  }
  if (ghost.slowedSeconds > 0) {
    fillRect(ctx, "#bdf6ff", x - 12, y - 11, 2, 2);
    fillRect(ctx, "#bdf6ff", x + 10, y - 7, 2, 2);
  }
  if (frozen) {
    fillRect(ctx, "rgba(120, 226, 255, 0.72)", x - 12, y - 12, 5, 5);
    fillRect(ctx, "rgba(206, 250, 255, 0.78)", x + 7, y - 12, 5, 5);
    fillRect(ctx, "rgba(112, 203, 255, 0.72)", x - 12, y + 8, 5, 5);
    fillRect(ctx, "rgba(206, 250, 255, 0.78)", x + 7, y + 8, 5, 5);
    ctx.strokeStyle = "#bff8ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 13, y - 13, 26, 28);
  }
  if (timeStopped) {
    ctx.strokeStyle = "#cabdff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 15 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    fillRect(ctx, "#d8caff", x - 1, y - 13, 2, 5);
    fillRect(ctx, "#d8caff", x + 1, y - 10, 4, 2);
  }
  if (ghost.stunnedSeconds > 0) {
    drawDiamond(ctx, x, y - 18 + Math.sin(time * 5) * 2, 3, "#fff2af");
  }
  if (disabled) {
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = frozen ? "#cbf8ff" : timeStopped ? "#e1d7ff" : "#fff5bd";
    ctx.shadowColor = "#141436";
    ctx.shadowBlur = 3;
    const seconds = frozen
      ? Math.ceil(ghost.frozenSeconds)
      : timeStopped
        ? Math.ceil(ghost.timeStoppedSeconds)
        : Math.ceil(ghost.stunnedSeconds);
    ctx.fillText(String(seconds), x, y - 22);
  }
  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  player: MazeSnapshot["players"][number],
  time: number,
) {
  if (player.status !== "active") return;
  const sprite = getGameplaySprite(player.characterId);
  const centerX = player.x * SIZE;
  const centerY = player.y * SIZE;
  const bob = player.isMoving ? Math.sin(time * 9 + player.controlIndex) * 0.7 : 0;
  const blinkAlpha =
    player.invulnerableSeconds > 0 && Math.floor(time * 14) % 2 === 0 ? 0.55 : 1;
  if (sprite) {
    const pixel = 1.45;
    const spriteColumns = sprite.grid.reduce((max, line) => Math.max(max, line.length), 0);
    const bodyWidth = spriteColumns * pixel;
    const bodyHeight = sprite.grid.length * pixel;
    const visualHeight = bodyHeight + pixel * 1.6 - 1;
    const spriteLeft = centerX - bodyWidth / 2;
    const anchorY = centerY - visualHeight / 2 + bob;
    const angle =
      player.direction === "up"
        ? -Math.PI / 2
        : player.direction === "down"
          ? Math.PI / 2
          : player.direction === "left"
            ? Math.PI
            : 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);
    ctx.globalAlpha = blinkAlpha;
    ctx.shadowColor = sprite.palette.m;
    ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 16 : 7;
    fillRect(ctx, "rgba(5, 11, 40, 0.45)", -10, 9, 20, 4);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    for (let row = 0; row < sprite.grid.length; row += 1) {
      const line = sprite.grid[row] ?? "";
      for (let column = 0; column < line.length; column += 1) {
        const pixelKey = line[column];
        if (!pixelKey || pixelKey === ".") continue;
        const key = pixelKey as keyof typeof sprite.palette;
        const visualColumn = player.direction === "left" ? spriteColumns - column - 1 : column;
        fillScaledSpriteRect(
          ctx,
          sprite.palette[key],
          spriteLeft + visualColumn * pixel,
          anchorY + row * pixel,
          pixel,
          pixel,
        );
      }
    }
    const legY = bodyHeight;
    const legShift = player.isMoving && Math.sin(time * 12 + player.controlIndex) > 0 ? 1 : 0;
    for (const legColumn of sprite.legColumns) {
      const visualLegColumn = player.direction === "left" ? spriteColumns - legColumn - 2 : legColumn;
      fillScaledSpriteRect(
        ctx,
        sprite.palette.o,
        spriteLeft + visualLegColumn * pixel,
        anchorY + legY - 1,
        pixel * 2,
        pixel * (1.2 + legShift * 0.4),
      );
    }
    ctx.restore();
  } else {
    const imageUrl =
      player.characterId === "calm-capybara-mage" ? capybaraImageUrl : axolotlImageUrl;
    let image = characterImageCache.get(imageUrl);
    if (!image) {
      image = new Image();
      image.src = imageUrl;
      characterImageCache.set(imageUrl, image);
    }
    ctx.save();
    ctx.globalAlpha = blinkAlpha;
    ctx.fillStyle = "rgba(5, 11, 40, 0.45)";
    ctx.fillRect(centerX - 10, centerY + 9, 20, 4);
    ctx.shadowColor = player.characterId === "axolotl-mage" ? "#ff9edb" : "#9de8cf";
    ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 16 : 7;
    if (image.complete && image.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      if (player.direction === "left") {
        ctx.translate(centerX, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(image, -SIZE * 0.58, centerY - SIZE * 0.58 + bob, SIZE * 1.16, SIZE * 1.16);
      } else {
        ctx.drawImage(
          image,
          centerX - SIZE * 0.58,
          centerY - SIZE * 0.58 + bob,
          SIZE * 1.16,
          SIZE * 1.16,
        );
      }
    } else {
      ctx.fillStyle = player.characterId === "axolotl-mage" ? "#ff9edb" : "#9de8cf";
      ctx.fillRect(centerX - 6, centerY - 7 + bob, 12, 14);
    }
    ctx.restore();
  }

  if (!player.isBot) {
    ctx.save();
    ctx.strokeStyle = "#aef4ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#8aeaff";
    ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 15 : 8;
    ctx.strokeRect(centerX - 13, centerY - 16, 26, 30);
    ctx.restore();
  }

  if (player.characterId === "time-owl-mage" && player.abilityActiveSeconds > 0) {
    const clockY = centerY - 22;
    ctx.save();
    ctx.globalAlpha = Math.min(1, player.abilityActiveSeconds * 2);
    ctx.strokeStyle = "#e9e2ff";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "#b6b2ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(centerX, clockY, 5 + Math.sin(time * 7) * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    fillRect(ctx, "#fffaff", centerX - 1, clockY - 3, 2, 4);
    fillRect(ctx, "#d8caff", centerX, clockY, 3, 1);
    for (let index = 0; index < 3; index += 1) {
      const angle = time * 3 + (index * Math.PI * 2) / 3;
      fillRect(
        ctx,
        index % 2 === 0 ? "#fffaff" : "#b6b2ff",
        centerX + Math.cos(angle) * 9 - 1,
        clockY + Math.sin(angle) * 7 - 1,
        2,
        2,
      );
    }
    ctx.restore();
  }

  if (player.invulnerableSeconds > 0) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(time * 9) * 0.12;
    ctx.strokeStyle = "#a9f6ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#71eaff";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 19 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = "#d8fbff";
    ctx.shadowColor = "#18234c";
    ctx.shadowBlur = 4;
    ctx.fillText(`ESCUDO ${Math.ceil(player.invulnerableSeconds)}`, centerX, centerY - 34);
    ctx.restore();
  }

  const badge = player.isBot ? `CPU${player.controlIndex}` : `P${player.controlIndex + 1}`;
  ctx.save();
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = player.isBot ? "#e9d7ff" : "#fff8c6";
  ctx.shadowColor = "#111432";
  ctx.shadowBlur = 4;
  ctx.fillText(badge, centerX, centerY - 18);
  if (player.controlIndex === 0 && !player.isBot) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillText("VOCÊ", centerX, centerY - 27);
  }
  ctx.restore();
}

function drawProjectiles(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (const projectile of snapshot.projectiles) {
    const x = projectile.x * SIZE;
    const y = projectile.y * SIZE;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 10);
    ctx.shadowColor = "#e6baff";
    ctx.shadowBlur = 12;
    drawDiamond(ctx, 0, 0, 8, "#da9cff");
    drawDiamond(ctx, 0, 0, 4, "#fff5ff");
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, time: number) {
  for (const effect of snapshot.effects) {
    const fade = Math.max(0.1, effect.secondsRemaining / effect.maxSeconds);
    const startX = effect.x * SIZE;
    const startY = effect.y * SIZE;
    ctx.save();
    ctx.globalAlpha = fade;
    if (effect.kind === "ice-ray" && effect.targetX !== undefined && effect.targetY !== undefined) {
      ctx.strokeStyle = "#aaf4ff";
      ctx.lineWidth = 5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(effect.targetX * SIZE, effect.targetY * SIZE);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (
      effect.kind === "root-tether" &&
      effect.targetX !== undefined &&
      effect.targetY !== undefined
    ) {
      ctx.strokeStyle = "#9de89b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(effect.targetX * SIZE, effect.targetY * SIZE);
      ctx.stroke();
      fillRect(ctx, "#d4ffac", effect.targetX * SIZE - 3, effect.targetY * SIZE - 3, 6, 6);
    } else if (
      effect.kind === "forge-impact" ||
      effect.kind === "gate-open" ||
      effect.kind === "hit"
    ) {
      ctx.strokeStyle = effect.kind === "hit" ? "#fff1a8" : "#ffb45f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(startX, startY, 8 + (1 - fade) * 15, 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 4; index += 1) {
        const angle = time * 4 + (index * Math.PI) / 2;
        fillRect(
          ctx,
          "#fff3bd",
          startX + Math.cos(angle) * 12,
          startY + Math.sin(angle) * 12,
          3,
          3,
        );
      }
    } else if (effect.kind === "time-vision") {
      ctx.strokeStyle = "rgba(194, 187, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      for (const ghost of snapshot.ghosts) {
        const vector = {
          up: { x: 0, y: -1 },
          right: { x: 1, y: 0 },
          down: { x: 0, y: 1 },
          left: { x: -1, y: 0 },
        }[ghost.direction];
        ctx.beginPath();
        ctx.moveTo(ghost.x * SIZE, ghost.y * SIZE);
        ctx.lineTo((ghost.x + vector.x * 1.7) * SIZE, (ghost.y + vector.y * 1.7) * SIZE);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else if (
      effect.kind === "ice-burst" ||
      effect.kind === "time-stop" ||
      effect.kind === "swamp-burst" ||
      effect.kind === "fire-burst" ||
      effect.kind === "teleport-smoke" ||
      effect.kind === "character-swap"
    ) {
      const color =
        effect.kind === "ice-burst"
          ? "#a9f5ff"
          : effect.kind === "time-stop"
            ? "#cbb9ff"
            : effect.kind === "swamp-burst"
              ? "#a1ee9a"
              : effect.kind === "fire-burst"
                ? "#ffad73"
                : effect.kind === "teleport-smoke"
                  ? "#dda9ff"
                  : "#91f2ff";
      const radius =
        effect.kind === "time-stop" ? 5 : 9 + (1 - fade) * (effect.kind === "fire-burst" ? 39 : 31);
      ctx.strokeStyle = color;
      ctx.lineWidth = effect.kind === "character-swap" ? 2 : 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
      for (let index = 0; index < 6; index += 1) {
        const angle = time * (effect.kind === "swamp-burst" ? 2 : 4) + (index * Math.PI) / 3;
        const distanceFromCenter = radius + (index % 2) * 4;
        const size = effect.kind === "teleport-smoke" ? 4 : 3;
        fillRect(
          ctx,
          color,
          startX + Math.cos(angle) * distanceFromCenter,
          startY + Math.sin(angle) * distanceFromCenter,
          size,
          size,
        );
      }
      if (effect.kind === "time-stop") {
        ctx.strokeStyle = "#f0eaff";
        ctx.beginPath();
        ctx.arc(startX, startY, Math.max(5, radius * 0.48), -Math.PI / 2, Math.PI * 0.9);
        ctx.stroke();
        fillRect(ctx, "#f0eaff", startX - 1, startY - 9, 2, 8);
        fillRect(ctx, "#f0eaff", startX, startY - 2, 6, 2);
      }
    }
    ctx.restore();
  }
}

function drawMatchFrame(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "#c7adff";
  ctx.lineWidth = 4;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, width - 12, height - 12);
}

const PIXEL_HEART_ROWS = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
const PIXEL_HEART_CELL_SIZE = 2;
const PIXEL_HEART_WIDTH = 14;
const PIXEL_HEART_HEIGHT = 12;
const PIXEL_HEART_GAP = 4;

function drawPixelHeart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  for (let row = 0; row < PIXEL_HEART_ROWS.length; row += 1) {
    const line = PIXEL_HEART_ROWS[row]!;
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== "#") continue;
      fillRect(
        ctx,
        "#64122f",
        x + column * PIXEL_HEART_CELL_SIZE + 1,
        y + row * PIXEL_HEART_CELL_SIZE + 1,
        PIXEL_HEART_CELL_SIZE,
        PIXEL_HEART_CELL_SIZE,
      );
    }
  }
  for (let row = 0; row < PIXEL_HEART_ROWS.length; row += 1) {
    const line = PIXEL_HEART_ROWS[row]!;
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== "#") continue;
      fillRect(
        ctx,
        row < 3 ? "#ff3b57" : "#e5224e",
        x + column * PIXEL_HEART_CELL_SIZE,
        y + row * PIXEL_HEART_CELL_SIZE,
        PIXEL_HEART_CELL_SIZE,
        PIXEL_HEART_CELL_SIZE,
      );
    }
  }
  fillRect(ctx, "#ffd8de", x + 2, y + 2, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
  fillRect(ctx, "#ffd8de", x + 10, y + 2, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
  ctx.restore();
}

function drawLocalLivesHud(ctx: CanvasRenderingContext2D, snapshot: MazeSnapshot, width: number) {
  const localPlayer = snapshot.players.find((player) => player.controlIndex === 0 && !player.isBot);
  const lives = Math.max(0, Math.floor(localPlayer?.lives ?? 0));
  if (lives === 0) return;

  const left = 8;
  const top = 2;
  const maxHeartsPerRow = Math.max(
    1,
    Math.floor((width - left * 2 + PIXEL_HEART_GAP) / (PIXEL_HEART_WIDTH + PIXEL_HEART_GAP)),
  );
  for (let index = 0; index < lives; index += 1) {
    const column = index % maxHeartsPerRow;
    const row = Math.floor(index / maxHeartsPerRow);
    drawPixelHeart(
      ctx,
      left + column * (PIXEL_HEART_WIDTH + PIXEL_HEART_GAP),
      top + row * (PIXEL_HEART_HEIGHT + PIXEL_HEART_GAP),
    );
  }
}

export function renderMaze(
  ctx: CanvasRenderingContext2D,
  snapshot: MazeSnapshot,
  time: number,
  showLocalLivesHud = false,
) {
  const width = snapshot.width * SIZE;
  const height = snapshot.height * SIZE;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#101c46");
  background.addColorStop(1, "#241641");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, snapshot, time);
  drawSwampZones(ctx, snapshot, time);
  drawItems(ctx, snapshot, time);
  drawPortal(ctx, snapshot.biome, snapshot.exit, snapshot.exitOpen, time);
  drawTeleportTargets(ctx, snapshot, time);
  for (const ghost of snapshot.ghosts) drawGhost(ctx, ghost, time);
  drawEffects(ctx, snapshot, time);
  drawProjectiles(ctx, snapshot, time);
  drawGlobalTimeStop(ctx, snapshot, time);
  for (const player of snapshot.players) drawCharacter(ctx, player, time);
  drawMatchFrame(ctx, width, height);
  if (showLocalLivesHud) drawLocalLivesHud(ctx, snapshot, width);
  ctx.restore();
}

export function renderCellCenter(cell: MazeCell) {
  return { x: (cell.x + 0.5) * SIZE, y: (cell.y + 0.5) * SIZE };
}

export function isOpenTile(tile: MazeTile) {
  return tile !== "wall" && tile !== "breakable";
}
