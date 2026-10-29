import Matter from "matter-js";

import { FINISH_Y, TOWER_CONFIG as C } from "./config";
import type { PlacementRecommendation, TowerEngine } from "./engine";
import { TETROMINO_COLORS, TETROMINO_SHAPES, type TetrominoType } from "./pieces";

function drawBlock(ctx: CanvasRenderingContext2D, type: TetrominoType, alpha = 1) {
  const [fill, light, shadow] = TETROMINO_COLORS[type];
  const s = C.cell;
  const h = s / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#1e2a5a";
  ctx.fillRect(-h, -h, s, s);
  ctx.fillStyle = shadow;
  ctx.fillRect(-h + 2, -h + 2, s - 4, s - 4);
  ctx.fillStyle = fill;
  ctx.fillRect(-h + 2, -h + 2, s - 7, s - 7);
  ctx.fillStyle = light;
  ctx.fillRect(-h + 4, -h + 4, 6, 3);
  ctx.fillRect(-h + 4, -h + 4, 3, 6);
  ctx.globalAlpha = 1;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body & { pieceType?: TetrominoType },
  alpha = 1,
) {
  const type = body.pieceType ?? "T";
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  for (const p of parts) {
    ctx.save();
    ctx.translate(p.position.x, p.position.y);
    ctx.rotate(body.angle);
    drawBlock(ctx, type, alpha);
    ctx.restore();
  }
}

function drawForgedHeat(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  left: number,
  time: number,
) {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  const strength = Math.min(1, left / C.forgedHeatSeconds);
  ctx.save();
  for (const part of parts) {
    ctx.beginPath();
    part.vertices.forEach((vertex, index) =>
      index === 0 ? ctx.moveTo(vertex.x, vertex.y) : ctx.lineTo(vertex.x, vertex.y),
    );
    ctx.closePath();
    ctx.fillStyle = `rgba(239,72,56,${0.18 + strength * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255,126,79,${0.25 + strength * 0.7})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (let index = 0; index < 7; index++) {
    const cycle = (time * 1.8 + index * 0.19) % 1;
    ctx.globalAlpha = strength * (1 - cycle);
    ctx.fillStyle = index % 3 === 0 ? "#fff4ef" : index % 2 ? "#ff7e4f" : "#ef4838";
    const width = Math.max(1, body.bounds.max.x - body.bounds.min.x);
    const x = body.bounds.min.x + ((index * 29 + 7) % width);
    ctx.fillRect(
      Math.round(x),
      Math.round(body.bounds.min.y - cycle * 18),
      index % 2 ? 3 : 2,
      index % 2 ? 3 : 2,
    );
  }
  for (let index = 0; index < 3; index++) {
    const cycle = (time * 0.35 + index * 0.32) % 1;
    ctx.globalAlpha = strength * 0.22 * (1 - cycle);
    ctx.fillStyle = "#e8f6ff";
    ctx.fillRect(
      Math.round(body.position.x - 8 + index * 8),
      Math.round(body.bounds.min.y - 8 - cycle * 15),
      6,
      6,
    );
  }
  ctx.restore();
}

function drawIsland(ctx: CanvasRenderingContext2D) {
  const x0 = (C.width - C.platformWidth) / 2;
  const top = C.platformTop;
  // grass/cloud top
  ctx.fillStyle = "#1e2a5a";
  ctx.fillRect(x0 - 2, top - 2, C.platformWidth + 4, 12);
  ctx.fillStyle = "#e8f6ff";
  ctx.fillRect(x0, top, C.platformWidth, 8);
  ctx.fillStyle = "#9ee8ff";
  for (let x = x0; x < x0 + C.platformWidth; x += 12) ctx.fillRect(x, top + 6, 6, 2);
  // rock body tapering
  const rows = ["#5a6ee0", "#4a58c8", "#3c46a8", "#7a4ec8", "#5a3a9a"];
  rows.forEach((color, i) => {
    const inset = i * 14;
    ctx.fillStyle = "#1e2a5a";
    ctx.fillRect(x0 + inset - 2, top + 10 + i * 12, C.platformWidth - inset * 2 + 4, 14);
    ctx.fillStyle = color;
    ctx.fillRect(x0 + inset, top + 10 + i * 12, C.platformWidth - inset * 2, 12);
  });
  // magic crystal
  ctx.fillStyle = "#b8f4ff";
  ctx.fillRect(C.width / 2 - 3, top + 70, 6, 8);
}

function drawFinishLine(
  ctx: CanvasRenderingContext2D,
  time: number,
  progress: number,
  closeness: number,
  won: boolean,
) {
  const y = FINISH_Y;
  const pulse = 0.5 + 0.5 * Math.sin(time * 6);
  const glow = won ? 1 : closeness > 0.75 ? (closeness - 0.75) * 4 : 0;
  ctx.fillStyle = `rgba(200,184,255,${0.18 + glow * 0.3 * pulse})`;
  ctx.fillRect(0, y - 6 - glow * 6, C.width, 12 + glow * 12);
  if (glow > 0) {
    for (let i = 0; i < 14; i++) {
      const px = (i * 53 + time * 30) % C.width;
      const py = y - 10 - ((i * 17 + time * 25) % 40);
      ctx.fillStyle = i % 2 ? "#ffffff" : "#9ee8ff";
      ctx.globalAlpha = glow * (1 - ((i * 17 + time * 25) % 40) / 40);
      ctx.fillRect(Math.floor(px), Math.floor(py), 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  const offset = Math.floor(time * 20) % 16;
  for (let x = -16 + offset; x < C.width; x += 16) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y - 2, 8, 4);
    ctx.fillStyle = "#b58cff";
    ctx.fillRect(x + 8, y - 2, 8, 4);
  }
  if (progress > 0) {
    ctx.fillStyle = "#5ee6ff";
    ctx.fillRect(0, y + 4, C.width * progress, 3);
  }
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillStyle = "#1e2a5a";
  ctx.fillText("LINHA DE CHEGADA", 9, y - 9);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("LINHA DE CHEGADA", 8, y - 10);
}

interface TowerRenderOptions {
  highlightedPiece?: Matter.Body | null;
  highlightIce?: boolean;
  highlightColor?: string | undefined;
  tongue?: { body: Matter.Body; dir: Matter.Vector | null; reach: number } | null;
  showLandingGuide?: boolean;
  timeFrozen?: boolean;
  timeVision?: PlacementRecommendation | null;
  effectTime?: number;
  timeFreezeFade?: number;
}

/** Disposable geometry for a visual estimate; the real active body and world are never modified. */
function estimateLanding(engine: TowerEngine): number | null {
  const active = engine.active;
  if (!active) return null;
  const cells = active.parts.length > 1 ? active.parts.slice(1) : active.parts;
  const ghost = Matter.Body.create({
    parts: cells.map((part) =>
      Matter.Bodies.rectangle(part.position.x, part.position.y, C.cell, C.cell, {
        angle: active.angle,
      }),
    ),
  });
  const obstacles = [engine.platform, ...engine.pieces];
  const collides = () => Matter.Query.collides(ghost, obstacles).some((hit) => hit.depth > 0.1);
  if (collides()) return null;

  let distance = 0;
  const limit = C.height - active.bounds.max.y + C.cell;
  while (distance + 4 <= limit) {
    Matter.Body.setPosition(ghost, { x: active.position.x, y: active.position.y + distance + 4 });
    if (collides()) break;
    distance += 4;
  }
  while (distance + 1 <= limit) {
    Matter.Body.setPosition(ghost, { x: active.position.x, y: active.position.y + distance + 1 });
    if (collides()) break;
    distance += 1;
  }
  return distance;
}

function drawLandingGuide(ctx: CanvasRenderingContext2D, engine: TowerEngine) {
  const active = engine.active;
  if (!active) return;
  const distance = estimateLanding(engine);
  if (distance === null || distance < 2) return;
  const cells = active.parts.length > 1 ? active.parts.slice(1) : active.parts;
  const colors = getComputedStyle(ctx.canvas);
  ctx.save();
  ctx.strokeStyle = colors.getPropertyValue("--arcade-cyan").trim();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(Math.round(active.position.x) + 0.5, Math.round(active.bounds.max.y) + 4);
  ctx.lineTo(Math.round(active.position.x) + 0.5, Math.round(active.bounds.min.y + distance) - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = colors.getPropertyValue("--arcade-lilac").trim();
  ctx.strokeStyle = colors.getPropertyValue("--arcade-cloud").trim();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (const cell of cells) {
    ctx.beginPath();
    cell.vertices.forEach((vertex, index) => {
      if (index === 0) ctx.moveTo(vertex.x, vertex.y + distance);
      else ctx.lineTo(vertex.x, vertex.y + distance);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawFrost(ctx: CanvasRenderingContext2D, body: Matter.Body, left: number, time: number) {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  ctx.save();
  // Blink during the final second so the player sees it's about to thaw.
  const blink = left < 1 && Math.floor(time * 8) % 2 === 0 ? 0.25 : 0.45;
  for (const part of parts) {
    ctx.beginPath();
    part.vertices.forEach((v, i) => (i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
    ctx.closePath();
    ctx.fillStyle = `rgba(158,232,255,${blink})`;
    ctx.fill();
    ctx.strokeStyle = "#e8fbff";
    ctx.lineWidth = 2;
    ctx.stroke();
    // tiny pixel crystals on the corners
    ctx.fillStyle = "#ffffff";
    for (const v of part.vertices) ctx.fillRect(Math.round(v.x) - 2, Math.round(v.y) - 2, 3, 3);
  }
  // drifting snow pixels
  for (let i = 0; i < 4; i++) {
    const k = (time * 0.7 + i * 0.25) % 1;
    const x =
      body.bounds.min.x + ((i * 37 + 11) % Math.max(1, body.bounds.max.x - body.bounds.min.x));
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = i % 2 ? "#c8b8ff" : "#ffffff";
    ctx.fillRect(Math.round(x), Math.round(body.bounds.min.y - k * 14), 2, 2);
  }
  ctx.restore();
}

export const FROG_MOUTH = { x: 34, y: C.height - 70 };

function drawTongue(
  ctx: CanvasRenderingContext2D,
  t: NonNullable<TowerRenderOptions["tongue"]>,
  time: number,
) {
  const p = t.body.position;
  ctx.save();
  // pixel tongue: chunky dots from mouth to the piece
  const dx = p.x - FROG_MOUTH.x;
  const dy = p.y - FROG_MOUTH.y;
  const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / 4));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const wob = Math.sin(time * 12 + i * 0.6) * 1.5 * (1 - k);
    ctx.fillStyle = "#1f6b3a";
    ctx.fillRect(
      Math.round(FROG_MOUTH.x + dx * k) - 3,
      Math.round(FROG_MOUTH.y + dy * k + wob) - 3,
      6,
      6,
    );
    ctx.fillStyle = i % 2 ? "#5fd67a" : "#8ef0a2";
    ctx.fillRect(
      Math.round(FROG_MOUTH.x + dx * k) - 2,
      Math.round(FROG_MOUTH.y + dy * k + wob) - 2,
      4,
      4,
    );
  }
  // grab splash
  ctx.fillStyle = "#5ee6ff";
  ctx.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 5, 10, 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + time * 2;
    ctx.fillStyle = i % 3 === 2 ? "#c8b8ff" : "#5fd67a";
    ctx.fillRect(Math.round(p.x + Math.cos(a) * 14), Math.round(p.y + Math.sin(a) * 14), 3, 3);
  }
  // pull direction arrow (short, capped)
  if (t.dir) {
    const len = Math.hypot(t.dir.x, t.dir.y) || 1;
    const ux = t.dir.x / len;
    const uy = t.dir.y / len;
    const ex = p.x + ux * (t.reach + 14);
    const ey = p.y + uy * (t.reach + 14);
    ctx.strokeStyle = "#5ee6ff";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(ex + ux * 6, ey + uy * 6);
    ctx.lineTo(ex - uy * 6, ey + ux * 6);
    ctx.lineTo(ex + uy * 6, ey - ux * 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPieceOutline(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  ice = false,
  color?: string,
) {
  const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
  ctx.save();
  ctx.strokeStyle = color ?? (ice ? "#9ee8ff" : "#d9b8ff");
  ctx.lineWidth = 5;
  ctx.shadowColor = ice ? "#5ee6ff" : "#9d6cff";
  ctx.shadowBlur = 10;
  for (const part of parts) {
    ctx.beginPath();
    part.vertices.forEach((vertex, index) => {
      if (index === 0) ctx.moveTo(vertex.x, vertex.y);
      else ctx.lineTo(vertex.x, vertex.y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawTimeVision(
  ctx: CanvasRenderingContext2D,
  engine: TowerEngine,
  recommendation: PlacementRecommendation,
  time: number,
) {
  const active = engine.active;
  if (!active?.pieceType) return;

  const cells = TETROMINO_SHAPES[active.pieceType];
  const centerX = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
  const centerY = cells.reduce((sum, [, y]) => sum + y, 0) / cells.length;
  const pulse = 0.68 + Math.sin(time * 6) * 0.12;

  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "#b58cff";
  ctx.lineWidth = 3;
  ctx.shadowColor = "#9d6cff";
  ctx.shadowBlur = 10;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(active.position.x, active.position.y);
  ctx.lineTo(recommendation.x, active.position.y);
  ctx.lineTo(recommendation.x, recommendation.y);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 10; i++) {
    const t = (time * 0.18 + i / 10) % 1;
    const x = recommendation.x + Math.sin(t * Math.PI * 2) * (i % 2 ? 4 : 1);
    const y = active.position.y + (recommendation.y - active.position.y) * t;
    ctx.globalAlpha = 0.35 + (i % 3) * 0.15;
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#d9b8ff" : "#9d6cff";
    ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 3 : 2, i % 2 ? 3 : 2);
  }

  ctx.save();
  ctx.translate(recommendation.x, recommendation.y);
  ctx.rotate(active.angle + recommendation.quarterTurns * (Math.PI / 2));
  ctx.globalAlpha = 0.3 * pulse;
  ctx.fillStyle = "#9d6cff";
  ctx.strokeStyle = "#f4ecff";
  ctx.lineWidth = 2;
  for (const [x, y] of cells) {
    const px = (x - centerX) * C.cell;
    const py = (y - centerY) * C.cell;
    ctx.fillRect(px - C.cell / 2, py - C.cell / 2, C.cell, C.cell);
    ctx.strokeRect(px - C.cell / 2, py - C.cell / 2, C.cell, C.cell);
    ctx.globalAlpha = 0.85 * pulse;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - C.cell / 2 + 4, py - C.cell / 2 + 4, 4, 3);
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = "#9d6cff";
  }
  ctx.restore();

  const radius = 28 + Math.sin(time * 4) * 2;
  ctx.globalAlpha = 0.66;
  ctx.strokeStyle = "#d9b8ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.ellipse(recommendation.x, recommendation.y, radius + 8, radius, time * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + time * 0.5;
    const x = recommendation.x + Math.cos(angle) * (radius + 8);
    const y = recommendation.y + Math.sin(angle) * radius;
    ctx.fillStyle = i % 2 ? "#b58cff" : "#ffffff";
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
  }

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#f4ecff";
  ctx.font = "7px 'Press Start 2P', monospace";
  ctx.fillText(
    recommendation.quarterTurns ? `GIRO ${recommendation.quarterTurns}x` : "SEM GIRO",
    Math.max(4, recommendation.x - 34),
    Math.max(15, recommendation.y - radius - 8),
  );
  ctx.restore();
}

function drawTimeFreeze(ctx: CanvasRenderingContext2D, time: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = 0.45 * opacity;
  ctx.strokeStyle = "#b58cff";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, C.width - 4, C.height - 4);
  ctx.fillStyle = "#f4ecff";
  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.fillText("⧗", C.width - 22, 19);

  for (let i = 0; i < 12; i++) {
    const phase = (time * 0.12 + i / 12) % 1;
    const x = (i * 67 + 21) % C.width;
    const y = C.height - phase * (C.height - 28) - 14;
    ctx.globalAlpha = (0.18 + (i % 3) * 0.1) * (0.65 + Math.sin(time * 2 + i) * 0.2) * opacity;
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#d9b8ff" : "#9d6cff";
    ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 3 : 2, i % 2 ? 3 : 2);
  }
  ctx.restore();
}

export function renderTower(
  ctx: CanvasRenderingContext2D,
  engine: TowerEngine,
  time: number,
  options: TowerRenderOptions = {},
) {
  ctx.clearRect(0, 0, C.width, C.height);
  ctx.imageSmoothingEnabled = false;

  // drop guide for the active piece
  if (engine.active) {
    const b = engine.active.bounds;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(b.min.x, b.max.y, b.max.x - b.min.x, C.height);
  }

  drawIsland(ctx);
  const closeness = (C.platformTop - engine.topY) / (C.platformTop - FINISH_Y);
  drawFinishLine(ctx, time, engine.winProgress, closeness, engine.status === "won");
  // marker of the current tower top
  if (engine.topY < C.platformTop - 2) {
    ctx.fillStyle = "rgba(94,230,255,0.55)";
    for (let x = 0; x < C.width; x += 10) ctx.fillRect(x, Math.floor(engine.topY), 5, 2);
  }

  for (const p of engine.pieces) drawPiece(ctx, p);
  for (const [p, left] of engine.forged)
    if (engine.pieces.includes(p)) drawForgedHeat(ctx, p, left, time);
  for (const [p, left] of engine.frozen) drawFrost(ctx, p, left, time);
  for (const f of engine.freezeFx) {
    const k = f.t / 0.6;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "rgba(158,232,255,0.5)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, 10 + k * 26, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 6 + k * 34;
      ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#9ee8ff" : "#c8b8ff";
      ctx.fillRect(Math.floor(f.x + Math.cos(a) * r), Math.floor(f.y + Math.sin(a) * r), 3, 3);
    }
    ctx.globalAlpha = 1;
  }
  if (options.showLandingGuide) drawLandingGuide(ctx, engine);
  if (options.highlightedPiece && engine.pieces.includes(options.highlightedPiece)) {
    drawPieceOutline(ctx, options.highlightedPiece, options.highlightIce, options.highlightColor);
  }
  if (options.tongue && engine.pieces.includes(options.tongue.body)) {
    drawPieceOutline(ctx, options.tongue.body, false, "#8ef0a2");
    drawTongue(ctx, options.tongue, time);
  }
  // lost-piece pixel burst at the bottom edge
  for (const f of engine.lostFx) {
    const k = f.t / 0.8;
    ctx.globalAlpha = 1 - k;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI - Math.PI;
      const r = 8 + k * 60;
      ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#9ee8ff" : "#c8b8ff";
      ctx.fillRect(
        Math.floor(f.x + Math.cos(a) * r),
        Math.floor(C.height - 6 + Math.sin(a) * r),
        4,
        4,
      );
    }
    ctx.globalAlpha = 1;
  }
  if (engine.active) {
    drawPiece(ctx, engine.active);
    const heat = engine.forged.get(engine.active);
    if (heat !== undefined) drawForgedHeat(ctx, engine.active, heat, time);
  }
  if (options.timeVision)
    drawTimeVision(ctx, engine, options.timeVision, options.effectTime ?? time);
  if (options.timeFrozen) drawTimeFreeze(ctx, options.effectTime ?? time, 1);
  else if (options.timeFreezeFade && options.timeFreezeFade > 0)
    drawTimeFreeze(ctx, options.effectTime ?? time, options.timeFreezeFade);
}

export function renderPiecePreview(
  ctx: CanvasRenderingContext2D,
  type: TetrominoType,
  cells: [number, number][],
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const minX = Math.min(...cells.map((c) => c[0]));
  const maxX = Math.max(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const maxY = Math.max(...cells.map((c) => c[1]));
  const ox = (ctx.canvas.width - (maxX - minX + 1) * C.cell) / 2;
  const oy = (ctx.canvas.height - (maxY - minY + 1) * C.cell) / 2;
  for (const [x, y] of cells) {
    ctx.save();
    ctx.translate(ox + (x - minX + 0.5) * C.cell, oy + (y - minY + 0.5) * C.cell);
    drawBlock(ctx, type);
    ctx.restore();
  }
}
