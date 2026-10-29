import { SKY_FLAP_CONFIG as C } from "./config";
import type { SkyFlapObstacle, SkyFlapSnapshot } from "./engine";

export type SkyFlapWorldSnapshot = Pick<
  SkyFlapSnapshot,
  "phase" | "speedMultiplier" | "scrollDistance" | "obstacles"
>;

function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

const ENTRY_SPARKS = [0, 1, 2, 3, 4, 5] as const;
const PASS_SPARKS = [0, 1, 2, 3, 4] as const;

function drawSpeedStreaks(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapWorldSnapshot,
  time: number,
  speedProgress: number,
) {
  if (snapshot.phase !== "playing" || speedProgress <= 0) return;

  const intensity = Math.min(1, speedProgress);
  const count = 3 + Math.round(intensity * 5);
  const flowSpeed = 150 + intensity * 340;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = wrap(C.width - time * flowSpeed - i * 173, C.width);
    const y = 42 + ((i * 83 + 29) % (C.height - 84));
    ctx.globalAlpha = 0.045 + intensity * 0.085;
    ctx.fillStyle = i % 3 === 0 ? "#d8ceff" : "#d7faff";
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(5 + intensity * 8), 2);
  }
  ctx.restore();
}

function drawEntryParticles(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapSnapshot,
  progress: number,
  time: number,
) {
  if (snapshot.phase === "gameover" || progress >= 1) return;
  const radius = 8 + progress * 24;
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.8;
  for (const i of ENTRY_SPARKS) {
    const angle = i * ((Math.PI * 2) / ENTRY_SPARKS.length) + time * 0.25;
    const x = snapshot.playerX + Math.cos(angle) * radius;
    const y = snapshot.playerY + Math.sin(angle) * radius;
    ctx.fillStyle = i % 2 === 0 ? "#e8fbff" : "#c9baff";
    ctx.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 2, 2);
  }
  ctx.restore();
}

function drawScorePop(ctx: CanvasRenderingContext2D, snapshot: SkyFlapSnapshot, progress: number) {
  if (progress <= 0 || progress >= 1 || snapshot.phase !== "playing") return;
  const rise = progress * 16;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff1a6";
  ctx.fillText("+1", snapshot.playerX + 25, snapshot.playerY - 26 - rise);
  for (const i of PASS_SPARKS) {
    const angle = i * ((Math.PI * 2) / PASS_SPARKS.length) - Math.PI / 2;
    const radius = 5 + progress * 17;
    const x = snapshot.playerX + 18 + Math.cos(angle) * radius;
    const y = snapshot.playerY - 7 + Math.sin(angle) * radius;
    ctx.fillStyle = i % 2 === 0 ? "#e7fcff" : "#d4c7ff";
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 7 * scale;
  ctx.fillStyle = "rgba(206, 244, 255, 0.32)";
  ctx.fillRect(x + unit, y + unit, unit * 7, unit * 2);
  ctx.fillRect(x + unit * 2, y, unit * 3, unit * 3);
  ctx.fillRect(x + unit * 5, y + unit / 2, unit * 2, unit * 2.5);
  ctx.fillStyle = "rgba(244, 253, 255, 0.68)";
  ctx.fillRect(x + unit * 2, y + unit, unit * 3, unit);
  ctx.fillRect(x + unit * 5, y + unit * 1.5, unit, unit / 2);
}

function drawFloatingIsland(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const unit = 6 * scale;
  ctx.fillStyle = "#8be8f1";
  ctx.fillRect(x + unit * 2, y, unit * 12, unit * 2);
  ctx.fillStyle = "#6758b7";
  ctx.fillRect(x, y + unit * 2, unit * 16, unit * 2);
  ctx.fillStyle = "#373878";
  ctx.fillRect(x + unit * 2, y + unit * 4, unit * 12, unit * 2);
  ctx.fillRect(x + unit * 4, y + unit * 6, unit * 8, unit);
  ctx.fillStyle = "rgba(200, 247, 255, 0.75)";
  ctx.fillRect(x + unit * 4, y + unit * 2, unit * 3, unit / 2);
}

function drawSky(ctx: CanvasRenderingContext2D, snapshot: SkyFlapWorldSnapshot, time: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, C.height);
  gradient.addColorStop(0, "#172454");
  gradient.addColorStop(0.48, "#344e9b");
  gradient.addColorStop(0.82, "#5eb8df");
  gradient.addColorStop(1, "#b5f2ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.width, C.height);

  // Parallax starfield: fixed-count pixel glints, independent of obstacle count.
  for (let i = 0; i < 42; i++) {
    const depth = i % 4 === 0 ? 0.2 : 0.055;
    const x = wrap(i * 173 + 29 - snapshot.scrollDistance * depth, C.width);
    const y = (i * 97 + 31) % C.height;
    const size = i % 7 === 0 ? 4 : 2;
    const twinkle = 0.42 + ((Math.sin(time * 2 + i * 1.7) + 1) / 2) * 0.5;
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = i % 5 === 0 ? "#d4c7ff" : "#e5fbff";
    ctx.fillRect(x, y, size, size);
    if (size === 4 && i % 2 === 0) {
      ctx.fillRect(x + 1, y - 2, 2, 8);
      ctx.fillRect(x - 2, y + 1, 8, 2);
    }
  }
  ctx.globalAlpha = 1;

  const clouds = [
    { x: 70, y: 105, scale: 1.2 },
    { x: 460, y: 225, scale: 0.85 },
    { x: 780, y: 82, scale: 0.75 },
    { x: 1060, y: 365, scale: 1.1 },
  ];
  for (const cloud of clouds) {
    const x = wrap(cloud.x - snapshot.scrollDistance * 0.12, C.width + 180) - 90;
    drawCloud(ctx, x, cloud.y, cloud.scale);
  }

  const islands = [
    { x: 180, y: 438, scale: 0.85 },
    { x: 660, y: 352, scale: 0.62 },
    { x: 1110, y: 470, scale: 0.95 },
  ];
  for (const island of islands) {
    const x = wrap(island.x - snapshot.scrollDistance * 0.28, C.width + 210) - 105;
    drawFloatingIsland(ctx, x, island.y, island.scale);
  }

  ctx.fillStyle = "rgba(209, 249, 255, 0.26)";
  ctx.fillRect(0, C.height - 8, C.width, 3);
  ctx.fillStyle = "rgba(174, 160, 255, 0.45)";
  ctx.fillRect(0, 0, C.width, 3);
}

function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#d5fbff";
  ctx.fillRect(x + 5, y, 6, 4);
  ctx.fillStyle = "#80e8f7";
  ctx.fillRect(x + 2, y + 4, 12, 7);
  ctx.fillStyle = "#967cf0";
  ctx.fillRect(x + 5, y + 11, 6, 5);
  ctx.fillStyle = "#f0ffff";
  ctx.fillRect(x + 5, y + 4, 3, 4);
}

function drawGateColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  isTop: boolean,
) {
  if (height <= 0) return;
  const width = C.obstacleWidth;
  ctx.fillStyle = "#20265c";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#55489f";
  ctx.fillRect(x + 6, y + 4, width - 12, Math.max(0, height - 8));
  ctx.fillStyle = "#70ddeb";
  ctx.fillRect(x + 8, y + 5, 4, Math.max(0, height - 10));
  ctx.fillStyle = "#a895ff";
  ctx.fillRect(x + width - 12, y + 5, 4, Math.max(0, height - 10));

  for (let runeY = y + 23; runeY < y + height - 24; runeY += 38) {
    ctx.fillStyle = "rgba(230, 246, 255, 0.9)";
    ctx.fillRect(x + 23, runeY, 8, 4);
    ctx.fillStyle = "#83e8f5";
    ctx.fillRect(x + 38, runeY + 9, 9, 4);
    ctx.fillStyle = "#ccbaff";
    ctx.fillRect(x + 26, runeY + 18, 6, 4);
  }

  const capY = isTop ? y + height - 22 : y;
  ctx.fillStyle = "#202454";
  ctx.fillRect(x - 8, capY, width + 16, 22);
  ctx.fillStyle = "#9275e8";
  ctx.fillRect(x - 4, capY + 3, width + 8, 14);
  ctx.fillStyle = "#a7f1f4";
  ctx.fillRect(x - 8, capY + (isTop ? 18 : 0), width + 16, 4);
  ctx.fillStyle = "#42367f";
  ctx.fillRect(x + 4, capY + 7, width - 8, 6);
  drawCrystal(ctx, x + width / 2 - 8, capY + (isTop ? 15 : -9));
}

function drawArcaneGate(ctx: CanvasRenderingContext2D, obstacle: SkyFlapObstacle) {
  const gapTop = obstacle.gapCenter - C.gapHeight / 2;
  const gapBottom = obstacle.gapCenter + C.gapHeight / 2;
  drawGateColumn(ctx, obstacle.x, 0, gapTop, true);
  drawGateColumn(ctx, obstacle.x, gapBottom, C.height - gapBottom, false);

  // Soft rune markers make the open passage legible without filling its hitbox.
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#d5caff";
  ctx.fillRect(obstacle.x + 30, gapTop + 12, 4, 4);
  ctx.fillStyle = "#a9f7ff";
  ctx.fillRect(obstacle.x + 42, gapBottom - 16, 4, 4);
  ctx.globalAlpha = 1;
}

function drawPlayerTrail(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapSnapshot,
  time: number,
  speedProgress: number,
) {
  if (snapshot.phase === "gameover") return;
  const y = snapshot.playerY;
  const pulse = Math.min(
    1,
    (0.45 + ((Math.sin(time * 12) + 1) / 2) * 0.35) * (1 + speedProgress * 0.35),
  );
  const trail = speedProgress * 10;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#e9ffff";
  ctx.fillRect(snapshot.playerX - 31 - trail, y - 2, 8, 4);
  ctx.fillStyle = "#86ecff";
  ctx.fillRect(snapshot.playerX - 43 - trail, y + 4, 5, 3);
  ctx.fillStyle = "#baa7ff";
  ctx.fillRect(snapshot.playerX - 52 - trail, y - 7, 4, 3);
  ctx.globalAlpha = 1;
}

export interface SkyFlapVisualEffects {
  entryProgress: number;
  scoreProgress: number;
}

export function drawSkyFlap(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapSnapshot,
  time: number,
  effects: SkyFlapVisualEffects = { entryProgress: 1, scoreProgress: 0 },
) {
  drawSkyFlapWorld(ctx, snapshot, time);
  drawSkyFlapPlayerEffects(ctx, snapshot, time, effects);
}

export function drawSkyFlapWorld(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapWorldSnapshot,
  time: number,
) {
  ctx.imageSmoothingEnabled = false;
  drawSky(ctx, snapshot, time);
  const speedProgress = Math.min(
    1,
    Math.max(0, (snapshot.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1)),
  );
  drawSpeedStreaks(ctx, snapshot, time, speedProgress);
  for (const obstacle of snapshot.obstacles) drawArcaneGate(ctx, obstacle);
}

export function drawSkyFlapPlayerEffects(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyFlapSnapshot,
  time: number,
  effects: SkyFlapVisualEffects = { entryProgress: 1, scoreProgress: 0 },
) {
  ctx.imageSmoothingEnabled = false;
  const speedProgress = Math.min(
    1,
    Math.max(0, (snapshot.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1)),
  );
  drawPlayerTrail(ctx, snapshot, time, speedProgress);
  drawEntryParticles(ctx, snapshot, effects.entryProgress, time);
  drawScorePop(ctx, snapshot, effects.scoreProgress);
}
