import Matter from "matter-js";

import { FINISH_Y, METERS_PER_PX, TOWER_CONFIG as C } from "./config";
import { createBag, TETROMINO_SHAPES, type TetrominoType } from "./pieces";

export type TowerStatus = "playing" | "won" | "lost";

export interface TowerSnapshot {
  status: TowerStatus;
  heightMeters: number;
  topY: number;
  lostPieces: number;
  maxLostPieces: number;
  positioningMarginState: "armed" | "active" | null;
  nextType: TetrominoType;
  placed: number;
  stablePieces: number;
  winConfirming: boolean;
  winSecondsRemaining: number;
}

export interface PlacementRecommendation {
  x: number;
  y: number;
  quarterTurns: number;
  support: number;
}

export interface TowerProbeResult {
  x: number;
  y: number;
  landY: number;
  support: number;
  minX: number;
  maxX: number;
  supportSpan: number;
  supportBalance: number;
}

export type PieceBody = Matter.Body & { pieceType?: TetrominoType };

// Tolerate only numerical contact below 0.025px; deeper overlap is treated as a collision.
const COLLISION_DEPTH_EPSILON = 0.025;
const BODY_SLOP = 0.005;

/** Tricky-Towers-style engine: controlled falling piece + real physics once it lands. */
export class TowerEngine {
  engine = Matter.Engine.create({
    positionIterations: 18,
    velocityIterations: 12,
    enableSleeping: true,
  });
  platform: Matter.Body;
  active: PieceBody | null = null;
  pieces: PieceBody[] = [];
  private stablePieces = new Set<PieceBody>();
  status: TowerStatus = "playing";
  lostPieces = 0;
  maxLostPieces: number = C.maxLostPieces;
  placed = 0;
  heightMeters = 0;
  topY: number = C.platformTop;
  lostFx: { x: number; t: number }[] = [];
  private restTime = new Map<Matter.Body, number>();
  /** Fox ability: pieces temporarily removed from simulation (seconds left). */
  frozen = new Map<Matter.Body, number>();
  freezeFx: { x: number; y: number; t: number }[] = [];
  /** Raccoon ability: remaining visual heat only; it never changes body physics. */
  forged = new Map<PieceBody, number>();
  softDrop = false;
  /** Optional fixed descent speed (used by bots). */
  dropSpeed: number | null = null;
  private nextPiece = createBag();
  nextType: TetrominoType;
  private spawnTimer = 0;
  private winTimer = 0;
  private positioningMarginArmed = false;
  private positioningMarginActive = false;

  constructor(maxLostPieces: number = C.maxLostPieces) {
    this.setMaxLostPieces(maxLostPieces);
    this.engine.gravity.y = 1;
    this.platform = Matter.Bodies.rectangle(C.width / 2, C.platformTop + 20, C.platformWidth, 40, {
      isStatic: true,
      friction: 1,
      frictionStatic: 2,
      slop: BODY_SLOP,
      label: "platform",
    });
    Matter.Composite.add(this.engine.world, this.platform);
    this.nextType = this.nextPiece();
    this.spawn();
  }

  private makePiece(type: TetrominoType, x: number, y: number): PieceBody {
    const cells = TETROMINO_SHAPES[type];
    const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
    const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
    const parts = cells.map(([gx, gy]) =>
      Matter.Bodies.rectangle(x + (gx - cx) * C.cell, y + (gy - cy) * C.cell, C.cell, C.cell, {
        slop: BODY_SLOP,
      }),
    );
    const body = Matter.Body.create({
      parts,
      friction: 1,
      frictionStatic: 3,
      frictionAir: 0.015,
      restitution: 0,
      density: 0.002,
      slop: BODY_SLOP,
    }) as PieceBody;
    body.pieceType = type;
    return body;
  }

  private spawn() {
    if (this.status !== "playing" || this.winTimer > 0) return;
    const type = this.nextType;
    this.nextType = this.nextPiece();
    const body = this.makePiece(type, C.width / 2, C.spawnY);
    Matter.Body.setStatic(body, true);
    const spawnPosition = this.findSafeSpawnPosition(body, C.width / 2, C.spawnY);
    if (!spawnPosition) {
      this.status = "lost";
      this.winTimer = 0;
      return;
    }
    Matter.Body.setPosition(body, spawnPosition);
    Matter.Composite.add(this.engine.world, body);
    this.active = body;
    this.positioningMarginActive = this.positioningMarginArmed;
    this.positioningMarginArmed = false;
  }

  get positioningMarginState(): "armed" | "active" | null {
    if (this.positioningMarginActive) return "active";
    return this.positioningMarginArmed ? "armed" : null;
  }

  /** Arms finer horizontal movement for the piece spawned after the current one. */
  activatePositioningMargin() {
    if (
      !this.active ||
      this.status !== "playing" ||
      this.positioningMarginArmed ||
      this.positioningMarginActive
    ) {
      return false;
    }
    this.positioningMarginArmed = true;
    return true;
  }

  cancelPositioningMargin() {
    this.positioningMarginArmed = false;
    this.positioningMarginActive = false;
  }

  setMaxLostPieces(limit: number) {
    this.maxLostPieces = Math.max(C.maxLostPieces, Math.floor(limit));
    if (this.status === "playing" && this.lostPieces >= this.maxLostPieces) {
      this.status = "lost";
      this.winTimer = 0;
    }
  }

  private findSafeSpawnPosition(body: Matter.Body, preferredX: number, y: number) {
    const original = { x: body.position.x, y: body.position.y };
    const maxSteps = Math.ceil(C.width / C.moveStep);
    for (let step = 0; step <= maxSteps; step += 1) {
      const offsets = step === 0 ? [0] : [-step * C.moveStep, step * C.moveStep];
      for (const offset of offsets) {
        const x = preferredX + offset;
        Matter.Body.setPosition(body, { x, y });
        const bounds = body.bounds;
        if (bounds.min.x >= 0 && bounds.max.x <= C.width && !this.collides(body)) {
          return { x, y };
        }
      }
    }
    Matter.Body.setPosition(body, original);
    return null;
  }

  private collides(body: Matter.Body) {
    const others = [this.platform, ...this.pieces];
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
    return parts.some((p) =>
      Matter.Query.collides(p, others).some(
        (collision) => collision.depth > COLLISION_DEPTH_EPSILON,
      ),
    );
  }

  private maxOverlapDepth(body: Matter.Body) {
    const others = [this.platform, ...this.pieces.filter((piece) => piece !== body)];
    const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
    let maxDepth = 0;
    for (const part of parts) {
      for (const collision of Matter.Query.collides(part, others)) {
        maxDepth = Math.max(maxDepth, collision.depth);
      }
    }
    return maxDepth;
  }

  /** Applies a small physical correction to residual overlaps left by the solver. */
  private resolveResidualOverlaps() {
    const pieceSet = new Set<Matter.Body>(this.pieces);
    const maxIterations = Math.min(64, Math.max(8, this.pieces.length * 4));
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      let deepest: {
        a: Matter.Body;
        b: Matter.Body;
        nx: number;
        ny: number;
        depth: number;
      } | null = null;
      for (const piece of this.pieces) {
        const others = [this.platform, ...this.pieces.filter((candidate) => candidate !== piece)];
        const parts = piece.parts.length > 1 ? piece.parts.slice(1) : piece.parts;
        for (const part of parts) {
          for (const collision of Matter.Query.collides(part, others)) {
            if (collision.depth <= COLLISION_DEPTH_EPSILON) continue;
            const { parentA: a, parentB: b, normal, depth } = collision;
            if (a === b) continue;
            if (!deepest || depth > deepest.depth) {
              deepest = { a, b, nx: normal.x, ny: normal.y, depth };
            }
          }
        }
      }
      if (!deepest) return;

      const { a, b, nx, ny, depth } = deepest;
      const moveA = pieceSet.has(a) && !a.isStatic;
      const moveB = pieceSet.has(b) && !b.isStatic;
      if (!moveA && !moveB) return;

      let target: Matter.Body;
      let direction: { x: number; y: number };
      if (moveA && !moveB) {
        target = a;
        direction = { x: nx, y: ny };
      } else if (moveB && !moveA) {
        target = b;
        direction = { x: -nx, y: -ny };
      } else if (Math.abs(ny) >= Math.abs(nx)) {
        // Move the upper piece so the lower, already-supported part of the stack stays put.
        target = ny > 0 ? b : a;
        direction = target === a ? { x: nx, y: ny } : { x: -nx, y: -ny };
      } else {
        target = b;
        direction = { x: -nx, y: -ny };
      }

      const correction = depth + BODY_SLOP;
      Matter.Body.setPosition(target, {
        x: target.position.x + direction.x * correction,
        y: target.position.y + direction.y * correction,
      });
      Matter.Sleeping.set(target, false);
      this.restTime.set(target, 0);
      this.stablePieces.delete(target as PieceBody);
    }
  }

  /** Replaces only the controlled piece at the normal spawn point, using standard piece physics. */
  forgeActivePiece(type: TetrominoType, heatSeconds: number): PieceBody | null {
    const previous = this.active;
    if (!previous || this.status !== "playing") return null;
    const body = this.makePiece(type, previous.position.x, previous.position.y);
    Matter.Body.setStatic(body, true);
    const safePosition = this.findSafeSpawnPosition(body, previous.position.x, previous.position.y);
    if (!safePosition) return null;
    Matter.Composite.remove(this.engine.world, previous);
    Matter.Body.setPosition(body, safePosition);
    Matter.Composite.add(this.engine.world, body);
    this.active = body;
    this.softDrop = false;
    this.forged.set(body, heatSeconds);
    return body;
  }

  private tryTransform(apply: () => void, undo: () => void) {
    if (!this.active || this.status !== "playing") return false;
    apply();
    const b = this.active.bounds;
    if (this.collides(this.active) || b.min.x < 0 || b.max.x > C.width) {
      undo();
      return false;
    }
    return true;
  }

  move(dir: -1 | 1): boolean {
    const body = this.active;
    if (!body) return false;
    const step = this.positioningMarginActive
      ? C.moveStep * C.capybaraMarginMoveFactor
      : C.moveStep;
    const d = dir * step;
    return this.tryTransform(
      () => Matter.Body.setPosition(body, { x: body.position.x + d, y: body.position.y }),
      () => Matter.Body.setPosition(body, { x: body.position.x - d, y: body.position.y }),
    );
  }

  rotate(): boolean {
    const body = this.active;
    if (!body) return false;
    return this.tryTransform(
      () => Matter.Body.rotate(body, Math.PI / 2),
      () => Matter.Body.rotate(body, -Math.PI / 2),
    );
  }

  /** Returns a settled tetromino under a world-space point. Active/preview pieces are excluded. */
  getPlacedPieceAt(point: Matter.Vector): PieceBody | null {
    const hits = Matter.Query.point(this.pieces, point);
    for (const hit of hits) {
      const piece = this.pieces.find(
        (candidate) =>
          candidate === hit || candidate === hit.parent || candidate.parts.includes(hit),
      );
      if (piece && piece !== this.active && piece.bounds.max.y <= C.height) return piece;
    }
    return null;
  }

  /** Removes one exact placed tetromino and lets every remaining body react naturally. */
  removePlacedPiece(piece: Matter.Body) {
    const index = this.pieces.indexOf(piece as PieceBody);
    if (index < 0 || piece === this.active) return false;
    const [removed] = this.pieces.splice(index, 1);
    if (!removed) return false;
    this.restTime.delete(removed);
    this.stablePieces.delete(removed);
    this.frozen.delete(removed);
    this.forged.delete(removed);
    Matter.Composite.remove(this.engine.world, removed);
    this.stablePieces.clear();
    for (const remaining of this.pieces) {
      this.restTime.set(remaining, 0);
      if (!remaining.isStatic) Matter.Sleeping.set(remaining, false);
    }
    return true;
  }

  /** Freezes one placed piece in place: it simply stops being simulated, no forces applied. */
  freezePiece(piece: Matter.Body, seconds: number) {
    if (!this.pieces.includes(piece as PieceBody) || piece === this.active) return false;
    Matter.Body.setVelocity(piece, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(piece, 0);
    Matter.Body.setStatic(piece, true);
    this.frozen.set(piece, seconds);
    this.freezeFx.push({ x: piece.position.x, y: piece.position.y, t: 0 });
    return true;
  }

  /** Frog ability: holds a placed piece still while the tongue is attached. */
  grabPiece(piece: Matter.Body) {
    if (!this.pieces.includes(piece as PieceBody) || piece === this.active) return false;
    this.frozen.delete(piece);
    Matter.Body.setVelocity(piece, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(piece, 0);
    Matter.Body.setStatic(piece, true);
    return true;
  }

  /** Total overlap of a piece against everything else (used so a pull never pushes deeper). */
  private overlapOf(piece: Matter.Body) {
    const others = [this.platform, ...this.pieces.filter((p) => p !== piece)];
    const parts = piece.parts.length > 1 ? piece.parts.slice(1) : piece.parts;
    let sum = 0;
    for (const part of parts) for (const c of Matter.Query.collides(part, others)) sum += c.depth;
    return sum;
  }

  /**
   * Starts a strong, collision-respecting pull. The piece stays held while the tongue
   * drags it fast across several frames (see tickPull), stopping at walls, floor or
   * other pieces, then hands it back to normal physics with no leftover velocity.
   */
  releaseGrab(piece: Matter.Body, dir: Matter.Vector | null, distance: number) {
    if (!this.pieces.includes(piece as PieceBody)) return;
    if (dir) {
      const len = Math.hypot(dir.x, dir.y) || 1;
      this.pull = { piece, ux: dir.x / len, uy: dir.y / len, left: distance };
    } else {
      this.finishPull(piece);
    }
  }

  /** Active tongue pull, dragged in fast small steps so it never tunnels. */
  private pull: { piece: Matter.Body; ux: number; uy: number; left: number } | null = null;

  /** True while the tongue is still dragging this piece. */
  isPulling(piece: Matter.Body) {
    return this.pull?.piece === piece;
  }

  /** Strong drag: many 1px steps per frame, stopping the moment it would overlap. */
  private tickPull(dt: number) {
    const p = this.pull;
    if (!p) return;
    if (!this.pieces.includes(p.piece)) {
      this.pull = null;
      return;
    }
    let steps = Math.max(2, Math.round(C.tonguePullSpeed * dt));
    let base = this.overlapOf(p.piece);
    while (steps-- > 0 && p.left > 0) {
      Matter.Body.setPosition(p.piece, {
        x: p.piece.position.x + p.ux,
        y: p.piece.position.y + p.uy,
      });
      const b = p.piece.bounds;
      const over = this.overlapOf(p.piece);
      if (b.min.x < 0 || b.max.x > C.width || b.min.y < 0 || over > base + 0.3) {
        Matter.Body.setPosition(p.piece, {
          x: p.piece.position.x - p.ux,
          y: p.piece.position.y - p.uy,
        });
        p.left = 0;
        break;
      }
      base = Math.min(base, over);
      p.left--;
    }
    if (p.left <= 0) {
      this.pull = null;
      this.finishPull(p.piece);
    }
  }

  /** Returns a pulled piece to normal physics: no force, no velocity, fully awake. */
  private finishPull(piece: Matter.Body) {
    Matter.Body.setStatic(piece, false);
    Matter.Body.setVelocity(piece, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(piece, 0);
    Matter.Sleeping.set(piece, false);
    this.restTime.set(piece, 0);
    for (const other of this.pieces) if (!other.isStatic) Matter.Sleeping.set(other, false);
    this.freezeFx.push({ x: piece.position.x, y: piece.position.y, t: 0.3 });
  }

  private tickFrozen(dt: number) {
    for (const [piece, left] of [...this.frozen]) {
      const t = left - dt;
      if (t > 0) {
        this.frozen.set(piece, t);
        continue;
      }
      this.frozen.delete(piece);
      Matter.Body.setStatic(piece, false);
      Matter.Body.setVelocity(piece, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(piece, 0);
      Matter.Sleeping.set(piece, false);
      this.restTime.set(piece, 0);
    }
  }

  hardDrop() {
    const body = this.active;
    if (!body || this.status !== "playing") return;
    // Same 1px sweep the normal descent uses, so the piece always stops flush.
    for (let i = 0; i < 900; i++) {
      Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y + 1 });
      if (this.collides(body) || body.position.y > C.height) {
        Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y - 1 });
        break;
      }
    }
    this.release();
  }

  /** During the Owl's time stop, only an intentional soft-drop input may advance the active piece. */
  stepControlledPiece(dt: number) {
    const body = this.active;
    if (!body || this.status !== "playing" || !this.softDrop) return;
    let remaining = C.softDropSpeed * dt;
    while (remaining > 0 && this.active === body) {
      const dy = Math.min(1, remaining);
      remaining -= dy;
      Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y + dy });
      if (this.collides(body)) {
        Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y - dy });
        this.release();
      } else if (body.bounds.min.y > C.height) {
        this.release();
      }
    }
  }

  /**
   * Simulates dropping the active piece with `rot` quarter turns at x, using the real
   * collision shapes. Restores the piece afterwards. Used by bots to evaluate moves.
   */
  probe(rot: number, x: number): TowerProbeResult | null {
    const body = this.active;
    if (!body || this.status !== "playing") return null;
    const pos = { x: body.position.x, y: body.position.y };
    const originalAngle = body.angle;
    let result: TowerProbeResult | null = null;
    try {
      let reachable = !this.collides(body);
      for (let turn = 0; turn < rot && reachable; turn += 1) {
        Matter.Body.rotate(body, Math.PI / 2);
        if (this.collides(body)) reachable = false;
      }

      let pathX = body.position.x;
      while (reachable && Math.abs(x - pathX) > 0.001) {
        const dx = Math.sign(x - pathX) * Math.min(C.moveStep, Math.abs(x - pathX));
        pathX += dx;
        Matter.Body.setPosition(body, { x: pathX, y: pos.y });
        const pathBounds = body.bounds;
        if (pathBounds.min.x < 0 || pathBounds.max.x > C.width || this.collides(body)) {
          reachable = false;
        }
      }

      if (reachable) {
        let y = pos.y;
        while (y < C.height + 40) {
          const candidateY = Math.min(y + 3, C.height + 40);
          Matter.Body.setPosition(body, { x, y: candidateY });
          if (this.collides(body)) {
            // Refine the 3px sweep to the last clear pixel so placement matches normal descent.
            for (let back = 1; back <= 2; back += 1) {
              const refinedY = candidateY - back;
              Matter.Body.setPosition(body, { x, y: refinedY });
              if (!this.collides(body)) {
                y = refinedY;
                break;
              }
            }
            break;
          }
          y = candidateY;
        }

        Matter.Body.setPosition(body, { x, y });
        if (y < C.height) {
          // Probe just below the landing; only upward-facing contacts count as weight-bearing support.
          Matter.Body.setPosition(body, { x, y: y + 3 });
          const others = [this.platform, ...this.pieces];
          const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
          const supportingParts: Matter.Body[] = [];
          const supportContactXs: number[] = [];
          for (const part of parts) {
            const contacts = Matter.Query.collides(part, others).filter(
              (collision) =>
                collision.depth > COLLISION_DEPTH_EPSILON && Math.abs(collision.normal.y) >= 0.5,
            );
            if (contacts.length === 0) continue;
            supportingParts.push(part);
            for (const collision of contacts) {
              for (const contact of collision.supports) {
                if (contact) supportContactXs.push(contact.x);
              }
            }
          }
          const supportXs = supportContactXs.length
            ? supportContactXs
            : supportingParts.map((part) => part.position.x);
          const supportMinX = supportXs.length ? Math.min(...supportXs) : body.position.x;
          const supportMaxX = supportXs.length ? Math.max(...supportXs) : body.position.x;
          const supportCenterX = supportXs.length
            ? supportXs.reduce((sum, value) => sum + value, 0) / supportXs.length
            : body.position.x;
          const supportSpan = supportXs.length ? supportMaxX - supportMinX + C.cell : 0;
          const halfSupportSpan = Math.max(C.cell / 2, supportSpan / 2);
          const balanceMargin = halfSupportSpan - Math.abs(body.position.x - supportCenterX);
          const supportBalance = supportXs.length
            ? Math.max(-1, Math.min(1, balanceMargin / halfSupportSpan))
            : -1;
          Matter.Body.setPosition(body, { x, y });
          result = {
            x: body.position.x,
            y: body.position.y,
            landY: body.bounds.max.y,
            support: supportingParts.length,
            minX: body.bounds.min.x,
            maxX: body.bounds.max.x,
            supportSpan,
            supportBalance,
          };
        }
      }
    } finally {
      Matter.Body.setPosition(body, pos);
      Matter.Body.setAngle(body, originalAngle);
      Matter.Body.setPosition(body, pos);
    }
    return result;
  }

  /** Scores the next visible piece on a temporary copy of the candidate landing. */
  futurePlacementQuality(rot: number, x: number, nextType: TetrominoType) {
    const current = this.active;
    if (!current?.pieceType || this.status !== "playing") return -100;
    const landing = this.probe(rot, x);
    if (!landing) return -100;

    const previousTopY = this.topY;
    const previousActive = this.active;
    const previousPieceCount = this.pieces.length;
    const shadow = this.makePiece(current.pieceType, landing.x, landing.y);
    Matter.Body.rotate(shadow, rot * (Math.PI / 2));
    Matter.Body.setStatic(shadow, true);
    const future = this.makePiece(nextType, C.width / 2, C.spawnY);
    Matter.Body.setStatic(future, true);

    try {
      this.pieces.push(shadow);
      this.topY = Math.min(this.topY, shadow.bounds.min.y);
      const spawnPosition = this.findSafeSpawnPosition(future, C.width / 2, C.spawnY);
      if (!spawnPosition) return -100;
      Matter.Body.setPosition(future, spawnPosition);
      this.active = future;

      const offsets = [
        -C.platformWidth / 2,
        -C.platformWidth / 4,
        0,
        C.platformWidth / 4,
        C.platformWidth / 2,
        landing.x - C.width / 2,
      ];
      const xs = [
        ...new Set(
          offsets.map((offset) => spawnPosition.x + Math.round(offset / C.moveStep) * C.moveStep),
        ),
      ];
      const platformLeft = (C.width - C.platformWidth) / 2;
      const platformRight = platformLeft + C.platformWidth;
      let best = -Infinity;

      for (let nextRot = 0; nextRot < 4; nextRot += 1) {
        for (const nextX of xs) {
          const nextLanding = this.probe(nextRot, nextX);
          if (!nextLanding) continue;
          const centerX = (nextLanding.minX + nextLanding.maxX) / 2;
          const overhang =
            Math.max(0, platformLeft - nextLanding.minX) +
            Math.max(0, nextLanding.maxX - platformRight);
          const quality =
            nextLanding.support * 18 +
            nextLanding.supportBalance * 26 +
            nextLanding.supportSpan * 0.14 +
            Math.max(0, C.platformTop - nextLanding.landY) * 0.1 -
            overhang * 4 -
            Math.abs(centerX - C.width / 2) * 0.08;
          best = Math.max(best, quality);
        }
      }
      return Number.isFinite(best) ? best : -100;
    } finally {
      this.pieces.length = previousPieceCount;
      this.topY = previousTopY;
      this.active = previousActive;
    }
  }

  /** Suggests a stable, reachable landing using the same collision-accurate probes as bots. */
  recommendActivePlacement(): PlacementRecommendation | null {
    const active = this.active;
    if (!active || this.status !== "playing") return null;

    const platformLeft = (C.width - C.platformWidth) / 2;
    const platformRight = platformLeft + C.platformWidth;
    const maxSteps = Math.ceil(C.width / C.moveStep);
    let best: PlacementRecommendation | null = null;
    let bestScore = -Infinity;

    for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
      for (let step = -maxSteps; step <= maxSteps; step++) {
        const x = active.position.x + step * C.moveStep;
        const landing = this.probe(quarterTurns, x);
        if (!landing) continue;

        const centerX = (landing.minX + landing.maxX) / 2;
        const overhang =
          Math.max(0, platformLeft - landing.minX) + Math.max(0, landing.maxX - platformRight);
        const score =
          landing.support * 40 +
          landing.landY * 0.12 -
          overhang * 5 -
          Math.abs(centerX - C.width / 2) * 0.16 -
          quarterTurns * 1.5;

        if (score > bestScore) {
          bestScore = score;
          best = { x: landing.x, y: landing.y, quarterTurns, support: landing.support };
        }
      }
    }
    return best;
  }

  /** Every piece — player or bot — enters the simulation the exact same way: at rest. */
  private release() {
    const body = this.active;
    if (!body) return;
    if (this.collides(body) && !this.separateFromOverlap(body)) {
      Matter.Composite.remove(this.engine.world, body);
      this.active = null;
      this.positioningMarginActive = false;
      this.positioningMarginArmed = false;
      this.status = "lost";
      this.winTimer = 0;
      return;
    }
    Matter.Body.setStatic(body, false);
    Matter.Sleeping.set(body, false);
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
    this.pieces.push(body);
    this.restTime.set(body, 0);
    this.stablePieces.delete(body);
    this.active = null;
    this.positioningMarginActive = false;
    this.placed++;
    this.spawnTimer = 0.45;
  }

  /** Finds the nearest clear pixel around an unexpectedly embedded active body. */
  private separateFromOverlap(body: Matter.Body) {
    const origin = { x: body.position.x, y: body.position.y };
    const maxDistance = C.cell * 2;
    for (let distance = 0.25; distance <= maxDistance; distance += 0.25) {
      const candidates = [
        { x: origin.x, y: origin.y - distance },
        { x: origin.x - distance, y: origin.y },
        { x: origin.x + distance, y: origin.y },
        { x: origin.x - distance, y: origin.y - distance },
        { x: origin.x + distance, y: origin.y - distance },
      ];
      for (const candidate of candidates) {
        Matter.Body.setPosition(body, candidate);
        const bounds = body.bounds;
        if (
          bounds.min.x >= 0 &&
          bounds.max.x <= C.width &&
          bounds.min.y >= 0 &&
          !this.collides(body)
        ) {
          return true;
        }
      }
    }
    Matter.Body.setPosition(body, origin);
    return false;
  }

  step(dt: number) {
    this.lostFx = this.lostFx.filter((f) => (f.t += dt) < 0.8);
    this.freezeFx = this.freezeFx.filter((f) => (f.t += dt) < 0.6);
    for (const [piece, left] of [...this.forged]) {
      const remaining = left - dt;
      if (remaining > 0 && (piece === this.active || this.pieces.includes(piece)))
        this.forged.set(piece, remaining);
      else this.forged.delete(piece);
    }
    this.tickFrozen(dt);
    this.tickPull(dt);
    if (this.status !== "playing") {
      Matter.Engine.update(this.engine, dt * 1000);
      this.resolveResidualOverlaps();
      return;
    }

    const body = this.active;
    if (body) {
      // Move in small increments so the piece never ends up inside another collider.
      const base = this.dropSpeed ?? C.fallSpeed;
      const speed = Math.min(
        C.softDropSpeed,
        this.softDrop ? Math.max(C.softDropSpeed, base) : base,
      );
      let remaining = speed * dt;
      while (remaining > 0 && this.active === body) {
        const dy = Math.min(1, remaining);
        remaining -= dy;
        Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y + dy });
        if (this.collides(body)) {
          Matter.Body.setPosition(body, { x: body.position.x, y: body.position.y - dy });
          this.release();
        } else if (body.bounds.min.y > C.height) {
          this.release();
        }
      }
    } else if (this.winTimer <= 0 && this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.spawn();
    }

    // Sub-step physics for stable stacking.
    const sub = 3;
    for (let i = 0; i < sub; i += 1) {
      Matter.Engine.update(this.engine, (dt * 1000) / sub);
      this.clampVelocities();
      this.resolveResidualOverlaps();
    }

    // Fallen pieces.
    for (const p of [...this.pieces]) {
      if (p.position.y > C.height + 60) {
        Matter.Composite.remove(this.engine.world, p);
        this.pieces = this.pieces.filter((x) => x !== p);
        this.frozen.delete(p);
        this.forged.delete(p);
        this.restTime.delete(p);
        this.stablePieces.delete(p);
        this.lostPieces++;
        this.lostFx.push({ x: Math.max(20, Math.min(C.width - 20, p.position.x)), t: 0 });
      }
    }
    if (this.lostPieces >= this.maxLostPieces) {
      this.status = "lost";
      this.winTimer = 0;
      return;
    }

    // Rest detection: once a piece is slow for a while, put it to sleep so it stays still.
    for (const p of this.pieces) {
      if (this.maxOverlapDepth(p) > COLLISION_DEPTH_EPSILON) {
        this.restTime.set(p, 0);
        this.stablePieces.delete(p);
        if (p.isSleeping && !p.isStatic) Matter.Sleeping.set(p, false);
        continue;
      }
      if (p.isSleeping || p.isStatic) continue;
      if (p.speed < 0.12 && p.angularSpeed < 0.004) {
        const t = (this.restTime.get(p) ?? 0) + dt;
        this.restTime.set(p, t);
        if (t > 0.5) {
          Matter.Body.setVelocity(p, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(p, 0);
          Matter.Sleeping.set(p, true);
          this.stablePieces.add(p);
        } else {
          this.stablePieces.delete(p);
        }
      } else {
        this.restTime.set(p, 0);
        this.stablePieces.delete(p);
      }
    }

    // Real highest point of the structure (bounds include rotation).
    let top: number = C.platformTop;
    for (const p of this.pieces) {
      const onIsland =
        p.bounds.max.y <= C.platformTop + 30 && p.position.x > -20 && p.position.x < C.width + 20;
      if (onIsland) top = Math.min(top, p.bounds.min.y);
    }
    this.topY = top;
    this.heightMeters = Math.max(0, Math.round((C.platformTop - top) * METERS_PER_PX * 10) / 10);

    const reachedFinish = top <= FINISH_Y;
    if (this.winTimer > 0 || reachedFinish) {
      this.winTimer += dt;
      if (this.winTimer >= C.winHoldSeconds) {
        if (reachedFinish) this.status = "won";
        else this.winTimer = 0;
      }
    }
  }

  /** Safety limits: a glitchy contact can never launch a piece. */
  private clampVelocities() {
    const maxSpeed = 6;
    const maxUp = 0.6;
    const maxAngular = 0.12;
    for (const p of this.pieces) {
      if (p.isSleeping || p.isStatic) continue;
      let { x, y } = p.velocity;
      const sp = Math.hypot(x, y);
      if (sp > maxSpeed) {
        x = (x / sp) * maxSpeed;
        y = (y / sp) * maxSpeed;
      }
      if (y < -maxUp) y = -maxUp;
      if (x !== p.velocity.x || y !== p.velocity.y) Matter.Body.setVelocity(p, { x, y });
      if (Math.abs(p.angularVelocity) > maxAngular) {
        Matter.Body.setAngularVelocity(p, Math.sign(p.angularVelocity) * maxAngular);
      }
    }
  }

  get winProgress() {
    return Math.min(1, this.winTimer / C.winHoldSeconds);
  }

  /** Completes the existing player status when all three opponents are defeated. */
  awardEliminationVictoryIfAllBotsLost(botEngines: readonly TowerEngine[]) {
    if (
      this.status !== "playing" ||
      botEngines.length !== 3 ||
      !botEngines.every((bot) => bot.status === "lost")
    ) {
      return false;
    }

    this.status = "won";
    this.winTimer = 0;
    return true;
  }

  snapshot(): TowerSnapshot {
    const winConfirming = this.status === "playing" && this.winTimer > 0;
    return {
      status: this.status,
      heightMeters: this.heightMeters,
      topY: this.topY,
      lostPieces: this.lostPieces,
      maxLostPieces: this.maxLostPieces,
      positioningMarginState: this.positioningMarginState,
      nextType: this.nextType,
      placed: this.placed,
      stablePieces: this.stablePieces.size,
      winConfirming,
      winSecondsRemaining: winConfirming ? Math.max(0, C.winHoldSeconds - this.winTimer) : 0,
    };
  }

  destroy() {
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
  }
}
