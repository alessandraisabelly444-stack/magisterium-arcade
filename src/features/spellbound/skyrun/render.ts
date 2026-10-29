import { SKY_RUN_CONFIG as C, SKY_RUN_TOTAL_DISTANCE } from "./config";
import type { SkyRunObjectType, SkyRunObstacle, SkyRunSnapshot } from "./engine";
import type { PlayableCharacterId } from "../types";

const STAR_COUNT = 42;
const FOREST_PARTICLE_COUNT = 20;
const RUINS_PARTICLE_COUNT = 18;
const SNOWFLAKE_COUNT = 26;
const ARCANE_PARTICLE_COUNT = 22;
const CANDY_PARTICLE_COUNT = 14;
const SPEED_LINE_COUNT = 8;
const RUN_TRAIL_COUNT = 4;
const BURST_PARTICLE_COUNT = 6;
const BURST_DIRECTIONS = [0, 1, 2, 3, 4, 5] as const;

type BiomePalette = {
  skyTop: string;
  skyMiddle: string;
  skyHorizon: string;
  skyGlow: string;
  ground: string;
  groundTop: string;
  groundLine: string;
  groundTile: string;
  groundAccent: string;
  obstacleOutline: string;
  obstacleMain: string;
  obstacleDark: string;
  obstacleLight: string;
  obstacleAccent: string;
};

const SKY_PALETTE: BiomePalette = {
  skyTop: "#172454",
  skyMiddle: "#344e9b",
  skyHorizon: "#5eb8df",
  skyGlow: "#aeefff",
  ground: "#272b66",
  groundTop: "#7466be",
  groundLine: "#b9f5ff",
  groundTile: "#a7a1ed",
  groundAccent: "#94deec",
  obstacleOutline: "#15172f",
  obstacleMain: "#5a4ba5",
  obstacleDark: "#302c70",
  obstacleLight: "#c9f8ff",
  obstacleAccent: "#7ce4f2",
};

const BIOME_PALETTES: readonly BiomePalette[] = [
  SKY_PALETTE,
  {
    skyTop: "#102f3a",
    skyMiddle: "#215c57",
    skyHorizon: "#79bb94",
    skyGlow: "#c2e9bd",
    ground: "#183d37",
    groundTop: "#4e8e67",
    groundLine: "#c7f3b1",
    groundTile: "#78d48d",
    groundAccent: "#b694e5",
    obstacleOutline: "#102827",
    obstacleMain: "#4a3d68",
    obstacleDark: "#243448",
    obstacleLight: "#a0f28f",
    obstacleAccent: "#dfb7ff",
  },
  {
    skyTop: "#191a3e",
    skyMiddle: "#36315f",
    skyHorizon: "#776c91",
    skyGlow: "#c1a77b",
    ground: "#292746",
    groundTop: "#655c80",
    groundLine: "#ead193",
    groundTile: "#bda46d",
    groundAccent: "#79dce9",
    obstacleOutline: "#111326",
    obstacleMain: "#55506c",
    obstacleDark: "#343149",
    obstacleLight: "#f0cd7e",
    obstacleAccent: "#83eaf1",
  },
  {
    skyTop: "#b8edff",
    skyMiddle: "#91cceb",
    skyHorizon: "#d8f4ff",
    skyGlow: "#f4fdff",
    ground: "#274d78",
    groundTop: "#5a91c0",
    groundLine: "#f4ffff",
    groundTile: "#c3f2ff",
    groundAccent: "#83dff1",
    obstacleOutline: "#173150",
    obstacleMain: "#3c7eaa",
    obstacleDark: "#235271",
    obstacleLight: "#f2ffff",
    obstacleAccent: "#8ceeff",
  },
  {
    skyTop: "#1b123b",
    skyMiddle: "#38236c",
    skyHorizon: "#62519b",
    skyGlow: "#9b87c7",
    ground: "#281d50",
    groundTop: "#583e91",
    groundLine: "#c8b7ff",
    groundTile: "#9a85da",
    groundAccent: "#70e6ed",
    obstacleOutline: "#eee5ff",
    obstacleMain: "#60418e",
    obstacleDark: "#38275f",
    obstacleLight: "#f1eaff",
    obstacleAccent: "#72f1ed",
  },
  {
    skyTop: "#8c78c8",
    skyMiddle: "#e9a6cf",
    skyHorizon: "#a7e6ed",
    skyGlow: "#fff0cf",
    ground: "#644351",
    groundTop: "#d98aad",
    groundLine: "#fff7dc",
    groundTile: "#ffe6a2",
    groundAccent: "#8ce3e5",
    obstacleOutline: "#39283d",
    obstacleMain: "#d65a7a",
    obstacleDark: "#794258",
    obstacleLight: "#fff2d4",
    obstacleAccent: "#86dfe3",
  },
];

const CHARACTER_FX: Record<PlayableCharacterId, { main: string; light: string }> = {
  "white-fox-ice-mage": { main: "#76dfff", light: "#e5fbff" },
  "purple-rabbit-ninja": { main: "#a888ed", light: "#e2d2ff" },
  "swamp-frog-mage": { main: "#58bd7b", light: "#c8f0a8" },
  "forge-raccoon-mage": { main: "#e66c43", light: "#ffc16d" },
  "time-owl-mage": { main: "#8275d2", light: "#e0d9ff" },
  "calm-capybara-mage": { main: "#83c9aa", light: "#d9f7e9" },
  "axolotl-mage": { main: "#e878b7", light: "#ffe1f3" },
};

function wrap(value: number, span: number) {
  return ((value % span) + span) % span;
}

type SurfaceKind = "ground" | "platform" | "floating" | "air";

interface SurfaceAnchor {
  readonly objectType: SkyRunObjectType;
  readonly kind: SurfaceKind;
  readonly y: number;
}

const GROUND_SURFACE: SurfaceAnchor = {
  objectType: "DECORATION",
  kind: "ground",
  y: C.groundY,
};

function topFromSurface(surface: SurfaceAnchor, height: number) {
  return surface.y - height;
}

function paletteFor(worldIndex: number) {
  const safeIndex = Math.max(0, Math.min(BIOME_PALETTES.length - 1, worldIndex));
  return BIOME_PALETTES[safeIndex] ?? SKY_PALETTE;
}

function drawGradientSky(ctx: CanvasRenderingContext2D, palette: BiomePalette) {
  const gradient = ctx.createLinearGradient(0, 0, 0, C.groundY);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(0.48, palette.skyMiddle);
  gradient.addColorStop(0.84, palette.skyHorizon);
  gradient.addColorStop(1, palette.skyGlow);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, C.width, C.height);
}

function drawStarField(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  worldIndex: number,
) {
  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < STAR_COUNT; i++) {
    const depth = i % 5 === 0 ? 0.16 : 0.045;
    const drift = worldIndex === 1 ? 0.6 : 1;
    const x = wrap(i * 191 + 17 - snapshot.distance * depth * drift, C.width);
    const y = (i * 89 + 23) % (C.groundY - 36);
    const size = i % 8 === 0 ? 3 : 2;
    ctx.globalAlpha = layerAlpha * (0.3 + ((Math.sin(time * 2.1 + i * 1.6) + 1) / 2) * 0.42);
    ctx.fillStyle = i % 4 === 0 ? "#d6caff" : "#e9fbff";
    ctx.fillRect(Math.round(x), y, size, size);
    if (size === 3 && i % 2 === 0) {
      ctx.fillRect(Math.round(x) + 1, y - 2, 1, 7);
      ctx.fillRect(Math.round(x) - 2, y + 1, 7, 1);
    }
  }
  ctx.restore();
}

function drawPixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const cloudAnchor: SurfaceAnchor = { objectType: "DECORATION", kind: "air", y };
  const u = 6 * scale;
  ctx.fillStyle = "rgba(220, 248, 255, 0.28)";
  ctx.fillRect(x + u, cloudAnchor.y + u, u * 7, u * 2);
  ctx.fillRect(x + u * 2, cloudAnchor.y, u * 3, u * 3);
  ctx.fillRect(x + u * 5, cloudAnchor.y + u / 2, u * 2, u * 2);
  ctx.fillStyle = "rgba(247, 254, 255, 0.58)";
  ctx.fillRect(x + u * 2, y + u, u * 3, u);
  ctx.fillRect(x + u * 5, y + u, u, u / 2);
}

function drawIsland(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const u = 6 * scale;
  const floatingSurface: SurfaceAnchor = {
    objectType: "DECORATION",
    kind: "floating",
    y: y + u * 7,
  };
  const islandTop = topFromSurface(floatingSurface, u * 7);
  ctx.fillStyle = "#83e8d0";
  ctx.fillRect(x + u * 2, islandTop, u * 12, u * 2);
  ctx.fillStyle = "#6b5cb3";
  ctx.fillRect(x, islandTop + u * 2, u * 16, u * 2);
  ctx.fillStyle = "#35346f";
  ctx.fillRect(x + u * 2, islandTop + u * 4, u * 12, u * 2);
  ctx.fillRect(x + u * 4, islandTop + u * 6, u * 8, u);
  ctx.fillStyle = "rgba(220, 251, 255, 0.72)";
  ctx.fillRect(x + u * 4, islandTop + u * 2, u * 3, u / 2);
}

function drawEnchantedSky(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  const palette = paletteFor(0);
  drawGradientSky(ctx, palette);
  drawStarField(ctx, snapshot, time, 0);

  const cloud1X = wrap(88 - snapshot.distance * 0.1, C.width + 170) - 85;
  const cloud2X = wrap(520 - snapshot.distance * 0.075, C.width + 160) - 80;
  const cloud3X = wrap(990 - snapshot.distance * 0.11, C.width + 180) - 90;
  drawPixelCloud(ctx, cloud1X, 108, 1.05);
  drawPixelCloud(ctx, cloud2X, 228, 0.72);
  drawPixelCloud(ctx, cloud3X, 72, 0.88);

  const island1X = wrap(175 - snapshot.distance * 0.22, C.width + 210) - 105;
  const island2X = wrap(705 - snapshot.distance * 0.17, C.width + 210) - 105;
  drawIsland(ctx, island1X, 348, 0.75);
  drawIsland(ctx, island2X, 386, 0.56);
  ctx.fillStyle = "#91eafa";
  ctx.fillRect(wrap(365 - snapshot.distance * 0.12, C.width), 184, 4, 9);
  ctx.fillRect(wrap(366 - snapshot.distance * 0.12, C.width), 181, 2, 3);
  ctx.fillStyle = "#c9b9ff";
  ctx.fillRect(wrap(836 - snapshot.distance * 0.09, C.width), 282, 5, 8);
}

function drawForest(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  drawGradientSky(ctx, paletteFor(1));
  for (let i = 0; i < 6; i++) {
    const x = wrap(i * 190 + 35 - snapshot.distance * 0.12, C.width + 150) - 75;
    const baseY = GROUND_SURFACE.y + 10;
    const topY = 90 + (i % 3) * 34;
    const crownColor = i % 2 === 0 ? "#174342" : "#1b4b47";
    ctx.fillStyle = "#173a3b";
    ctx.fillRect(x + 19, topY + 35, 18, baseY - topY - 35);
    ctx.fillStyle = crownColor;
    ctx.fillRect(x + 6, topY + 30, 45, 48);
    ctx.fillRect(x, topY + 52, 59, 39);
    ctx.fillRect(x + 15, topY + 9, 29, 34);
    ctx.fillStyle = "#28634f";
    ctx.fillRect(x + 13, topY + 39, 13, 8);
    ctx.fillRect(x + 35, topY + 60, 15, 8);
    ctx.fillStyle = "#6cc48b";
    ctx.fillRect(x + 24, topY + 18, 5, 4);
    ctx.fillRect(x + 7, topY + 61, 4, 3);
  }

  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < FOREST_PARTICLE_COUNT; i++) {
    const x = wrap(i * 73 + 24 - snapshot.distance * 0.2 + time * (9 + (i % 4) * 3), C.width);
    const y = (i * 61 + 42 + Math.round(Math.sin(time * 1.4 + i) * 8)) % (C.groundY - 80);
    ctx.globalAlpha = layerAlpha * (0.32 + (i % 4) * 0.12);
    ctx.fillStyle = i % 3 === 0 ? "#d2b8ff" : i % 3 === 1 ? "#b4f098" : "#77e4c9";
    ctx.fillRect(Math.round(x), y, i % 5 === 0 ? 4 : 2, 3);
    if (i % 5 === 0) ctx.fillRect(Math.round(x) + 1, y - 2, 2, 7);
  }
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    const x = wrap(105 + i * 275 - snapshot.distance * 0.15, C.width + 100) - 50;
    const stemHeight = 17 + (i % 2) * 2;
    const capHeight = 9 + (i % 3);
    const mushroomHeight = stemHeight + capHeight - 2;
    const capY = topFromSurface(GROUND_SURFACE, mushroomHeight);
    const stemY = capY + capHeight - 2;

    ctx.fillStyle = "#263a46";
    ctx.fillRect(x + 11, stemY, 8, GROUND_SURFACE.y - stemY);
    ctx.fillStyle = i % 2 === 0 ? "#a47bd0" : "#db8cdb";
    ctx.fillRect(x + 1, capY + 4, 28, capHeight - 2);
    ctx.fillRect(x + 5, capY, 20, 7);
    ctx.fillStyle = "#c7ffad";
    ctx.fillRect(x + 8, capY + 5, 4, 3);
    ctx.fillRect(x + 19, capY + 3, 3, 2);
    ctx.fillStyle = "#536b58";
    ctx.fillRect(x + 7, GROUND_SURFACE.y - 1, 17, 1);
  }

  ctx.save();
  ctx.globalAlpha *= 0.09;
  ctx.fillStyle = "#d7f4d1";
  const fogOffset = wrap(snapshot.distance * 0.04, C.width);
  ctx.fillRect(-fogOffset, 333, C.width, 29);
  ctx.fillRect(C.width - fogOffset, 355, C.width, 22);
  ctx.restore();
}

function drawRuins(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  drawGradientSky(ctx, paletteFor(2));
  drawStarField(ctx, snapshot, time, 2);

  const ruinsPlatform: SurfaceAnchor = {
    objectType: "DECORATION",
    kind: "platform",
    y: GROUND_SURFACE.y - 137,
  };
  const platformThickness = 28;
  ctx.fillStyle = "#292845";
  ctx.fillRect(0, ruinsPlatform.y, C.width, platformThickness);
  for (let i = 0; i < 6; i++) {
    const x = wrap(i * 190 + 100 - snapshot.distance * 0.11, C.width + 170) - 85;
    ctx.fillStyle = "#292845";
    ctx.fillRect(
      x + 21,
      ruinsPlatform.y + platformThickness,
      14,
      GROUND_SURFACE.y - (ruinsPlatform.y + platformThickness),
    );
    ctx.fillStyle = "#655c80";
    ctx.fillRect(
      x + 24,
      ruinsPlatform.y + platformThickness,
      4,
      GROUND_SURFACE.y - ruinsPlatform.y - platformThickness,
    );
    ctx.fillRect(x + 15, GROUND_SURFACE.y - 5, 26, 5);
  }

  ctx.fillStyle = "#393653";
  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 225 + 35 - snapshot.distance * 0.11, C.width + 170) - 85;
    const height = 148 - (i % 3) * 42;
    const top = topFromSurface(ruinsPlatform, height);
    ctx.fillRect(x + 10, top + 12, 38, height);
    ctx.fillRect(x + 3, top + 4, 52, 13);
    ctx.fillRect(x, top, 58, 8);
    ctx.fillStyle = i % 2 === 0 ? "#a98a61" : "#7b7190";
    ctx.fillRect(x + 15, top + 25, 4, 15);
    ctx.fillRect(x + 32, top + 49, 4, 12);
    ctx.fillStyle = "#393653";
  }

  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < RUINS_PARTICLE_COUNT; i++) {
    const x = wrap(i * 107 + 31 - snapshot.distance * 0.08 + time * (3 + (i % 3) * 2), C.width);
    const y = (i * 47 + 34 + Math.round(Math.sin(time + i * 0.7) * 5)) % 310;
    ctx.globalAlpha = layerAlpha * (0.34 + (i % 3) * 0.14);
    ctx.fillStyle = i % 2 === 0 ? "#f0ca82" : "#8aeaf0";
    ctx.fillRect(Math.round(x), y, 3, 3);
    if (i % 4 === 0) ctx.fillRect(Math.round(x) - 2, y + 1, 7, 1);
  }
  ctx.restore();

  for (let i = 0; i < 7; i++) {
    const x = wrap(i * 153 + 64 - snapshot.distance * 0.13, C.width);
    const y = 94 + ((i * 39) % 203);
    ctx.fillStyle = "rgba(239, 205, 127, 0.74)";
    ctx.fillRect(x, y, 8, 2);
    ctx.fillRect(x + 3, y - 4, 2, 10);
    ctx.fillStyle = "rgba(146, 220, 231, 0.68)";
    ctx.fillRect(x + 11, y + 4, 2, 7);
    ctx.fillRect(x + 8, y + 7, 8, 2);
  }
}

function drawPixelMountain(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  height: number,
  width: number,
  color: string,
) {
  ctx.fillStyle = color;
  const steps = 8;
  for (let row = 0; row < steps; row++) {
    const rowWidth = Math.round(width * ((row + 1) / steps));
    const y = baseY - Math.round(height * ((steps - row) / steps));
    ctx.fillRect(
      Math.round(x + (width - rowWidth) / 2),
      y,
      rowWidth,
      Math.ceil(height / steps) + 2,
    );
  }
}

function drawIceRealm(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  drawGradientSky(ctx, paletteFor(3));
  const iceShelf: SurfaceAnchor = {
    objectType: "DECORATION",
    kind: "ground",
    y: GROUND_SURFACE.y + 10,
  };
  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 240 - 85 - snapshot.distance * 0.08, C.width + 260) - 130;
    const height = 104 + (i % 3) * 38;
    const mountainTop = topFromSurface(iceShelf, height);
    drawPixelMountain(
      ctx,
      x,
      iceShelf.y,
      height,
      205 + (i % 2) * 45,
      i % 2 === 0 ? "#83b7df" : "#739fce",
    );
    ctx.fillStyle = "#eefcff";
    ctx.fillRect(x + 86, mountainTop + 4, 20, 8);
    ctx.fillRect(x + 72, mountainTop + 12, 13, 7);
  }

  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 215 + 22 - snapshot.distance * 0.15, C.width + 120) - 60;
    const crystalHeight = 137 + (i % 3) * 21;
    const top = topFromSurface(GROUND_SURFACE, crystalHeight);
    const baseY = GROUND_SURFACE.y;
    ctx.fillStyle = "#275278";
    ctx.fillRect(x + 12, top + 34, 11, baseY - (top + 34));
    ctx.fillRect(x + 3, top + 45, 29, 12);
    ctx.fillRect(x + 6, top + 27, 23, 14);
    ctx.fillRect(x + 9, top + 12, 17, 13);
    ctx.fillRect(x + 12, top, 11, 11);
    ctx.fillStyle = "#e7fbff";
    ctx.fillRect(x + 8, top + 30, 4, 4);
    ctx.fillRect(x + 23, top + 18, 4, 4);
    ctx.fillStyle = "#91d9f0";
    ctx.fillRect(x + 13, top + 57, 3, 39);
  }

  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
    const x = wrap(i * 137 + 13 - snapshot.distance * 0.1 + time * (11 + (i % 3) * 5), C.width);
    const y = wrap(i * 71 + time * (24 + (i % 5) * 4), C.groundY - 30);
    const size = i % 6 === 0 ? 4 : 2;
    ctx.globalAlpha = layerAlpha * (0.42 + (i % 4) * 0.12);
    ctx.fillStyle = i % 3 === 0 ? "#ffffff" : "#c8f5ff";
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
    if (size === 4) {
      ctx.fillRect(Math.round(x) + 1, Math.round(y) - 2, 2, 8);
      ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 8, 2);
    }
  }
  ctx.restore();
}

function drawArcaneDimension(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
) {
  drawGradientSky(ctx, paletteFor(4));
  drawStarField(ctx, snapshot, time, 4);

  for (let i = 0; i < 3; i++) {
    const x = wrap(116 + i * 385 - snapshot.distance * 0.12, C.width + 180) - 90;
    const y = 88 + (i % 2) * 71;
    const width = 56 + (i % 2) * 12;
    const height = 111 + (i % 2) * 22;
    ctx.fillStyle = "#d5c6ff";
    ctx.fillRect(x, y, 7, height);
    ctx.fillRect(x + width - 7, y, 7, height);
    ctx.fillRect(x, y, width, 7);
    ctx.fillRect(x, y + height - 7, width, 7);
    ctx.fillStyle = "rgba(97, 68, 159, 0.62)";
    ctx.fillRect(x + 7, y + 7, width - 14, height - 14);
    ctx.fillStyle = "#70e9ef";
    ctx.fillRect(x + width / 2 - 2, y + 12, 4, height - 24);
    ctx.fillStyle = "#f2dcff";
    ctx.fillRect(x + width / 2 - 7, y + 18 + Math.round(Math.sin(time * 2 + i) * 4), 14, 3);
  }

  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 217 + 36 - snapshot.distance * 0.2, C.width + 160) - 80;
    const y = 342 + (i % 3) * 24;
    const width = 44 + (i % 2) * 18;
    const floatingSurface: SurfaceAnchor = {
      objectType: "DECORATION",
      kind: "floating",
      y: y + 21,
    };
    const platformTop = topFromSurface(floatingSurface, 21);
    ctx.fillStyle = "#382b6f";
    ctx.fillRect(x + 8, platformTop + 11, width - 16, 10);
    ctx.fillRect(x + 2, platformTop + 4, width - 4, 8);
    ctx.fillStyle = "#8672c8";
    ctx.fillRect(x + 6, platformTop, width - 12, 7);
    ctx.fillStyle = "#76edf0";
    ctx.fillRect(x + 12, platformTop + 2, 8, 2);

    ctx.save();
    for (let step = 0; step < 3; step++) {
      const beamY = floatingSurface.y + 5 + step * 8;
      if (beamY >= GROUND_SURFACE.y - 7) continue;
      ctx.globalAlpha = 0.26 - step * 0.055;
      ctx.fillStyle = step % 2 === 0 ? "#76edf0" : "#d5c6ff";
      ctx.fillRect(x + Math.floor(width / 2) - 1, beamY, 2, 3);
      if (step === 0) ctx.fillRect(x + 5, beamY + 2, 2, 2);
    }
    ctx.restore();
  }

  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < ARCANE_PARTICLE_COUNT; i++) {
    const x = wrap(i * 97 + 20 - snapshot.distance * 0.17 + time * (5 + (i % 4) * 4), C.width);
    const y = (i * 59 + 31 + Math.round(Math.sin(time * 1.6 + i) * 10)) % (C.groundY - 38);
    ctx.globalAlpha = layerAlpha * (0.35 + (i % 4) * 0.12);
    ctx.fillStyle = i % 2 === 0 ? "#8cf4f3" : "#dfc8ff";
    ctx.fillRect(Math.round(x), y, 3, 3);
    if (i % 4 === 0) ctx.fillRect(Math.round(x) + 1, y - 3, 1, 9);
  }
  ctx.restore();
}

function drawCandyWorld(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  drawGradientSky(ctx, paletteFor(5));

  const cloud1X = wrap(92 - snapshot.distance * 0.07, C.width + 180) - 90;
  const cloud2X = wrap(615 - snapshot.distance * 0.05, C.width + 180) - 90;
  drawPixelCloud(ctx, cloud1X, 92, 1.05);
  drawPixelCloud(ctx, cloud2X, 194, 0.72);

  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 230 + 5 - snapshot.distance * 0.065, C.width + 300) - 150;
    const width = 210 + (i % 2) * 36;
    const height = 86 + (i % 3) * 22;
    drawPixelMountain(ctx, x, 394, height, width, i % 2 === 0 ? "#bf83bd" : "#82c9d5");
    drawPixelMountain(ctx, x + 24, 399, Math.round(height * 0.64), width - 42, "#f6c9d9");
    ctx.fillStyle = "#fff0c8";
    ctx.fillRect(x + Math.round(width * 0.48), 394 - height + 12, 17, 5);
    ctx.fillRect(x + Math.round(width * 0.48) + 5, 394 - height + 7, 8, 5);
  }

  // Candy trees and marshmallow shrubs are scenery; gameplay hazards stay on the track.
  for (let i = 0; i < 4; i++) {
    const x = wrap(76 + i * 285 - snapshot.distance * 0.17, C.width + 220) - 110;
    const trunkTop = 207 + (i % 2) * 18;
    ctx.fillStyle = "#8b5260";
    ctx.fillRect(x + 20, trunkTop + 30, 12, GROUND_SURFACE.y - trunkTop - 30);
    ctx.fillStyle = "#ffeeb9";
    for (let row = 0; row < 4; row++) {
      ctx.fillRect(x + 9 + row * 4, trunkTop + row * 7, 35 - row * 8, 7);
    }
    ctx.fillStyle = i % 2 === 0 ? "#e46f9a" : "#8bcbd7";
    ctx.fillRect(x + 4, trunkTop + 2, 44, 21);
    ctx.fillRect(x + 10, trunkTop - 5, 32, 10);
    ctx.fillRect(x + 17, trunkTop - 11, 18, 8);
    ctx.fillStyle = "#fff0cf";
    ctx.fillRect(x + 14, trunkTop + 7, 5, 4);
    ctx.fillRect(x + 33, trunkTop + 12, 5, 4);

    const bushX = wrap(172 + i * 250 - snapshot.distance * 0.2, C.width + 170) - 85;
    ctx.fillStyle = "#e9b5d0";
    ctx.fillRect(bushX + 3, GROUND_SURFACE.y - 15, 39, 14);
    ctx.fillRect(bushX + 9, GROUND_SURFACE.y - 22, 24, 9);
    ctx.fillStyle = "#fff4dd";
    ctx.fillRect(bushX + 13, GROUND_SURFACE.y - 17, 5, 3);
    ctx.fillRect(bushX + 29, GROUND_SURFACE.y - 13, 5, 3);
  }

  for (let i = 0; i < 4; i++) {
    const x = wrap(210 + i * 260 - snapshot.distance * 0.15, C.width + 140) - 70;
    const capY = GROUND_SURFACE.y - 30 - (i % 2) * 4;
    ctx.fillStyle = "#8b5260";
    ctx.fillRect(x + 11, capY + 13, 8, GROUND_SURFACE.y - capY - 13);
    ctx.fillStyle = i % 2 === 0 ? "#ee8caf" : "#9c88d4";
    ctx.fillRect(x + 2, capY + 7, 27, 10);
    ctx.fillRect(x + 7, capY + 2, 17, 8);
    ctx.fillRect(x + 12, capY, 8, 5);
    ctx.fillStyle = "#fff2d6";
    ctx.fillRect(x + 8, capY + 9, 4, 3);
    ctx.fillRect(x + 20, capY + 6, 4, 3);
  }

  // Biscuit ledges are decorative and visibly supported down to the running ground.
  for (let i = 0; i < 3; i++) {
    const x = wrap(160 + i * 360 - snapshot.distance * 0.19, C.width + 180) - 90;
    const y = 345 + (i % 2) * 17;
    ctx.fillStyle = "#9d654e";
    ctx.fillRect(x + 12, y + 8, 82, 13);
    ctx.fillStyle = "#e8bc79";
    ctx.fillRect(x + 7, y, 92, 12);
    ctx.fillStyle = "#fff0c8";
    ctx.fillRect(x + 13, y + 2, 80, 3);
    ctx.fillStyle = "#9d654e";
    ctx.fillRect(x + 19, y + 21, 8, GROUND_SURFACE.y - y - 21);
    ctx.fillRect(x + 79, y + 21, 8, GROUND_SURFACE.y - y - 21);
    ctx.fillStyle = "#d99565";
    ctx.fillRect(x + 32, y + 5, 5, 4);
    ctx.fillRect(x + 61, y + 5, 5, 4);
  }

  // A shallow chocolate ribbon is embedded in the distant terrain, not suspended in the sky.
  const chocolateOffset = wrap(snapshot.distance * 0.09, C.width);
  ctx.fillStyle = "#754251";
  ctx.fillRect(-chocolateOffset, 382, C.width, 17);
  ctx.fillRect(C.width - chocolateOffset, 382, C.width, 17);
  ctx.fillStyle = "#c77b80";
  ctx.fillRect(-chocolateOffset, 382, C.width, 3);
  ctx.fillRect(C.width - chocolateOffset, 382, C.width, 3);

  const layerAlpha = ctx.globalAlpha;
  ctx.save();
  for (let i = 0; i < CANDY_PARTICLE_COUNT; i++) {
    const x = wrap(i * 83 + 29 - snapshot.distance * 0.14 + time * (4 + (i % 4) * 2), C.width);
    const y = (i * 67 + 58 + Math.round(Math.sin(time * 1.5 + i) * 9)) % (C.groundY - 54);
    ctx.globalAlpha = layerAlpha * (0.34 + (i % 3) * 0.11);
    ctx.fillStyle = ["#fff0ca", "#f48db1", "#92e3e9", "#c3a5ef"][i % 4]!;
    ctx.fillRect(Math.round(x), y, i % 3 === 0 ? 4 : 2, 2);
    if (i % 4 === 0) ctx.fillRect(Math.round(x) + 1, y - 2, 2, 6);
  }
  ctx.restore();

  for (let i = 0; i < 5; i++) {
    const x = wrap(i * 197 + 22 - snapshot.distance * 0.12, C.width);
    const y = 112 + ((i * 53) % 179);
    ctx.fillStyle = "rgba(255, 244, 215, 0.66)";
    ctx.fillRect(x + 3, y, 2, 9);
    ctx.fillRect(x, y + 3, 8, 2);
  }
}

function drawWorldBackdrop(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  worldIndex: number,
) {
  if (worldIndex === 1) drawForest(ctx, snapshot, time);
  else if (worldIndex === 2) drawRuins(ctx, snapshot, time);
  else if (worldIndex === 3) drawIceRealm(ctx, snapshot, time);
  else if (worldIndex === 4) drawArcaneDimension(ctx, snapshot, time);
  else if (worldIndex === 5) drawCandyWorld(ctx, snapshot, time);
  else drawEnchantedSky(ctx, snapshot, time);
}

function drawGround(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, worldIndex: number) {
  const palette = paletteFor(worldIndex);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, C.groundY, C.width, C.height - C.groundY);
  ctx.fillStyle = palette.groundTop;
  ctx.fillRect(0, C.groundY + 8, C.width, 18);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, C.groundY + 26, C.width, C.height - C.groundY - 26);
  ctx.fillStyle = palette.groundLine;
  ctx.fillRect(0, C.groundY, C.width, 5);
  ctx.fillStyle = palette.groundAccent;
  ctx.fillRect(0, C.groundY + 5, C.width, 3);

  const tileWidth = 88;
  const offset = wrap(snapshot.distance * 0.6, tileWidth);
  for (let i = -1; i < 13; i++) {
    const x = Math.round(i * tileWidth - offset);
    ctx.fillStyle = palette.groundTile;
    if (worldIndex === 1) {
      ctx.fillRect(x + 14, C.groundY + 13, 19, 4);
      ctx.fillRect(x + 22, C.groundY + 10, 4, 3);
      ctx.fillStyle = "#306c53";
      ctx.fillRect(x + 20, C.groundY + 18, 3, 5);
    } else if (worldIndex === 2) {
      ctx.fillRect(x + 10, C.groundY + 12, 27, 5);
      ctx.fillRect(x + 14, C.groundY + 19, 18, 3);
      ctx.fillStyle = "#413958";
      ctx.fillRect(x + 43, C.groundY + 11, 20, 4);
    } else if (worldIndex === 3) {
      ctx.fillRect(x + 14, C.groundY + 12, 18, 4);
      ctx.fillRect(x + 50, C.groundY + 18, 16, 3);
      ctx.fillStyle = "#dffaff";
      ctx.fillRect(x + 18, C.groundY + 13, 7, 2);
    } else if (worldIndex === 4) {
      ctx.fillRect(x + 13, C.groundY + 13, 21, 4);
      ctx.fillRect(x + 21, C.groundY + 10, 5, 3);
      ctx.fillStyle = "#3b286e";
      ctx.fillRect(x + 54, C.groundY + 19, 9, 3);
    } else if (worldIndex === 5) {
      ctx.fillRect(x + 10, C.groundY + 12, 24, 5);
      ctx.fillRect(x + 17, C.groundY + 19, 5, 3);
      ctx.fillStyle = "#8a5260";
      ctx.fillRect(x + 47, C.groundY + 11, 22, 5);
      ctx.fillStyle = "#fff0c8";
      ctx.fillRect(x + 51, C.groundY + 12, 5, 2);
    } else {
      ctx.fillRect(x + 16, C.groundY + 14, 12, 3);
      ctx.fillStyle = "#373875";
      ctx.fillRect(x + 21, C.groundY + 13, 3, 5);
      ctx.fillStyle = "rgba(219, 244, 255, 0.56)";
      ctx.fillRect(x + 52, C.groundY + 21, 7, 2);
    }
  }
}

function drawWorldLayer(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  worldIndex: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  drawWorldBackdrop(ctx, snapshot, time, worldIndex);
  drawGround(ctx, snapshot, worldIndex);
  ctx.restore();
}

function drawObstacleOutline(
  ctx: CanvasRenderingContext2D,
  obstacle: SkyRunObstacle,
  palette: BiomePalette,
) {
  const x = Math.round(obstacle.x);
  const top = obstacle.surfaceY - obstacle.height;
  ctx.fillStyle = palette.obstacleOutline;
  ctx.fillRect(x - 2, top - 2, obstacle.width + 4, obstacle.height + 4);
  ctx.fillStyle = palette.obstacleDark;
  ctx.fillRect(x, top, obstacle.width, obstacle.height);
  return { x, top, mid: x + Math.floor(obstacle.width / 2), width: obstacle.width };
}

function drawSpireObstacle(ctx: CanvasRenderingContext2D, obstacle: SkyRunObstacle) {
  const palette = paletteFor(obstacle.worldIndex);
  const { x, top, mid, width } = drawObstacleOutline(ctx, obstacle, palette);
  const height = obstacle.height;

  if (obstacle.worldIndex === 1) {
    ctx.fillStyle = palette.obstacleMain;
    ctx.fillRect(mid - 5, top + 11, 10, height - 11);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 2, top + 5, width - 4, 11);
    ctx.fillRect(x + 5, top + 1, width - 10, 6);
    ctx.fillStyle = palette.obstacleLight;
    ctx.fillRect(x + 7, top + 7, 4, 3);
    ctx.fillRect(x + width - 12, top + 5, 4, 3);
  } else {
    ctx.fillStyle = palette.obstacleMain;
    ctx.fillRect(mid - 8, top + 10, 16, height - 10);
    ctx.fillRect(mid - 6, top + 5, 12, 6);
    ctx.fillRect(mid - 3, top + 1, 6, 5);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(mid - 5, top + 11, 4, Math.max(4, height - 16));
    ctx.fillStyle = palette.obstacleLight;
    ctx.fillRect(mid - 2, top + 4, 3, 6);
    ctx.fillStyle = palette.obstacleMain;
    ctx.fillRect(x + 2, obstacle.surfaceY - 5, width - 4, 3);
  }

  if (obstacle.worldIndex === 2) {
    ctx.fillStyle = palette.obstacleLight;
    ctx.fillRect(x + 4, top + 17, 3, 3);
    ctx.fillRect(x + width - 7, top + 25, 3, 3);
  } else if (obstacle.worldIndex === 3) {
    ctx.fillStyle = palette.obstacleLight;
    ctx.fillRect(mid + 4, top + 12, 3, Math.max(4, height - 18));
    ctx.fillRect(mid - 11, top + 20, 3, 4);
  } else if (obstacle.worldIndex === 4) {
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(mid + 6, top + 15, 3, Math.max(4, height - 21));
    ctx.fillRect(mid - 11, top + 8, 3, 4);
  }
}

function drawColumnObstacle(ctx: CanvasRenderingContext2D, obstacle: SkyRunObstacle) {
  const palette = paletteFor(obstacle.worldIndex);
  const { x, top, width } = drawObstacleOutline(ctx, obstacle, palette);
  const height = obstacle.height;

  ctx.fillStyle = palette.obstacleMain;
  ctx.fillRect(x + 7, top + 9, width - 14, height - 9);
  ctx.fillStyle = palette.obstacleLight;

  if (obstacle.worldIndex === 1) {
    ctx.fillRect(x + 2, top + 8, width - 4, 8);
    ctx.fillRect(x + 5, top + 3, width - 10, 7);
    ctx.fillRect(x + 9, top + 1, width - 18, 4);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 3, obstacle.surfaceY - 6, 8, 5);
    ctx.fillRect(x + width - 11, obstacle.surfaceY - 5, 8, 4);
  } else if (obstacle.worldIndex === 2) {
    ctx.fillRect(x + 3, top + 4, width - 6, 6);
    ctx.fillRect(x + 1, top + 1, width - 2, 5);
    ctx.fillRect(x + 5, top + 14, 3, 5);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + width - 10, top + 22, 3, 6);
  } else if (obstacle.worldIndex === 3) {
    ctx.fillRect(x + 4, top + 2, width - 8, 5);
    ctx.fillRect(x + 9, top + 8, 4, height - 12);
    ctx.fillRect(x + width - 13, top + 12, 4, height - 17);
  } else if (obstacle.worldIndex === 4) {
    ctx.fillRect(x + 3, top + 2, width - 6, 5);
    ctx.fillRect(x + 3, obstacle.surfaceY - 6, width - 6, 5);
    ctx.fillRect(x + 6, top + 8, 4, height - 15);
    ctx.fillRect(x + width - 10, top + 8, 4, height - 15);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + Math.floor(width / 2) - 2, top + 12, 4, height - 24);
  } else {
    ctx.fillRect(x + 2, top + 1, width - 4, 8);
    ctx.fillRect(x + 4, top + 6, width - 8, 3);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 11, top + 17, 4, 4);
    ctx.fillRect(x + width - 16, top + 24, 4, 4);
  }
}

function drawMoundObstacle(ctx: CanvasRenderingContext2D, obstacle: SkyRunObstacle) {
  const palette = paletteFor(obstacle.worldIndex);
  const { x, top, width } = drawObstacleOutline(ctx, obstacle, palette);
  const height = obstacle.height;

  ctx.fillStyle = palette.obstacleMain;
  ctx.fillRect(x + 3, top + 12, width - 6, height - 12);
  ctx.fillRect(x + 7, top + 7, width - 14, height - 7);
  ctx.fillStyle = palette.obstacleLight;

  if (obstacle.worldIndex === 1) {
    ctx.fillRect(x + 3, top + 8, width - 6, 6);
    ctx.fillRect(x + 9, top + 4, width - 18, 6);
    ctx.fillRect(x + 13, top + 1, width - 26, 4);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 1, obstacle.surfaceY - 7, 11, 4);
    ctx.fillRect(x + width - 12, obstacle.surfaceY - 8, 11, 5);
  } else if (obstacle.worldIndex === 2) {
    ctx.fillRect(x + 4, top + 6, width - 8, 5);
    ctx.fillRect(x + 10, top + 14, 3, 6);
    ctx.fillRect(x + width - 14, top + 20, 4, 5);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 5, top + 2, 8, 3);
  } else if (obstacle.worldIndex === 3) {
    ctx.fillRect(x + 3, top + 10, width - 6, 5);
    ctx.fillRect(x + 7, top + 5, width - 14, 7);
    ctx.fillRect(x + 14, top + 1, width - 28, 6);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 7, top + 17, 4, 3);
  } else if (obstacle.worldIndex === 4) {
    ctx.fillRect(x + 4, top + 10, width - 8, 4);
    ctx.fillRect(x + 9, top + 5, width - 18, 7);
    ctx.fillRect(x + 13, top + 1, width - 26, 6);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 2, top + 18, 6, 3);
    ctx.fillRect(x + width - 9, top + 23, 7, 3);
  } else {
    ctx.fillRect(x + 7, top + 5, width - 14, 4);
    ctx.fillRect(x + 11, top + 2, width - 22, 4);
    ctx.fillStyle = palette.obstacleAccent;
    ctx.fillRect(x + 8, top + 16, 5, 3);
    ctx.fillRect(x + width - 13, top + 20, 5, 2);
  }
}

function drawCandyObstacle(ctx: CanvasRenderingContext2D, obstacle: SkyRunObstacle) {
  const x = Math.round(obstacle.x);
  const top = obstacle.surfaceY - obstacle.height;
  const width = obstacle.width;
  const mid = x + Math.floor(width / 2);
  const outline = "#39283d";

  if (obstacle.kind === "lollipop") {
    const candyWidth = Math.min(28, width - 8);
    const candyHeight = Math.min(26, obstacle.height - 12);
    const candyX = mid - Math.floor(candyWidth / 2);
    const candyY = top + 1;
    ctx.fillStyle = outline;
    ctx.fillRect(
      mid - 4,
      candyY + candyHeight - 1,
      8,
      obstacle.surfaceY - candyY - candyHeight + 1,
    );
    ctx.fillRect(candyX + 4, candyY, candyWidth - 8, candyHeight);
    ctx.fillRect(candyX, candyY + 4, candyWidth, candyHeight - 8);
    ctx.fillStyle = "#e85f91";
    ctx.fillRect(candyX + 4, candyY + 4, candyWidth - 8, candyHeight - 8);
    ctx.fillRect(candyX + 2, candyY + 8, candyWidth - 4, candyHeight - 16);
    ctx.fillStyle = "#fff0d3";
    ctx.fillRect(candyX + 6, candyY + 7, 5, 4);
    ctx.fillRect(candyX + candyWidth - 11, candyY + 13, 5, 4);
    ctx.fillStyle = "#f8a6c6";
    ctx.fillRect(mid - 3, candyY + candyHeight, 6, obstacle.surfaceY - candyY - candyHeight);
  } else if (obstacle.kind === "chocolate-bar") {
    ctx.fillStyle = outline;
    ctx.fillRect(x + 1, top + 3, width - 2, obstacle.height - 3);
    ctx.fillStyle = "#824450";
    ctx.fillRect(x + 4, top + 2, width - 8, obstacle.height - 4);
    ctx.fillStyle = "#bd765b";
    ctx.fillRect(x + 6, top + 5, width - 12, 6);
    const segmentWidth = Math.max(8, Math.floor((width - 12) / 3));
    for (let segment = 0; segment < 3; segment++) {
      const segmentX = x + 6 + segment * segmentWidth;
      ctx.fillStyle = segment % 2 === 0 ? "#9c594e" : "#ad6552";
      ctx.fillRect(segmentX, top + 13, segmentWidth - 2, obstacle.height - 17);
      ctx.fillStyle = "#e9a16d";
      ctx.fillRect(segmentX + 2, top + 15, Math.max(2, segmentWidth - 7), 3);
    }
  } else if (obstacle.kind === "cookie-block") {
    ctx.fillStyle = outline;
    ctx.fillRect(x + 3, top, width - 6, obstacle.height);
    ctx.fillRect(x, top + 4, width, obstacle.height - 8);
    ctx.fillStyle = "#dca967";
    ctx.fillRect(x + 4, top + 4, width - 8, obstacle.height - 8);
    ctx.fillStyle = "#f4d395";
    ctx.fillRect(x + 7, top + 7, width - 14, 5);
    ctx.fillStyle = "#754b4c";
    for (let chip = 0; chip < 5; chip++) {
      const chipX = x + 7 + ((chip * 11 + 3) % Math.max(8, width - 14));
      const chipY = top + 16 + ((chip * 7) % Math.max(6, obstacle.height - 22));
      ctx.fillRect(chipX, chipY, 4, 3);
    }
  } else if (obstacle.kind === "sugar-crystal") {
    ctx.fillStyle = outline;
    ctx.fillRect(mid - 10, top + 10, 20, obstacle.height - 10);
    ctx.fillRect(mid - 6, top + 4, 12, 8);
    ctx.fillRect(mid - 3, top, 6, 6);
    ctx.fillStyle = "#84dfe4";
    ctx.fillRect(mid - 7, top + 12, 14, obstacle.height - 12);
    ctx.fillRect(mid - 4, top + 5, 8, 8);
    ctx.fillRect(mid - 2, top + 1, 4, 5);
    ctx.fillStyle = "#f1ffff";
    ctx.fillRect(mid - 4, top + 14, 3, Math.max(4, obstacle.height - 21));
    ctx.fillRect(mid + 2, top + 7, 2, 6);
  } else if (obstacle.kind === "marshmallow-stack") {
    ctx.fillStyle = outline;
    ctx.fillRect(x + 4, top + 1, width - 8, 14);
    ctx.fillRect(x, top + 7, width, 15);
    ctx.fillRect(x + 4, top + 14, width - 8, obstacle.height - 14);
    ctx.fillStyle = "#fff1dd";
    ctx.fillRect(x + 6, top + 3, width - 12, 9);
    ctx.fillRect(x + 2, top + 9, width - 4, 9);
    ctx.fillRect(x + 6, top + 17, width - 12, obstacle.height - 18);
    ctx.fillStyle = "#f2a6c4";
    ctx.fillRect(x + 7, top + 12, width - 14, 3);
    ctx.fillRect(x + 8, top + 25, width - 16, 3);
  } else {
    ctx.fillStyle = outline;
    ctx.fillRect(x + 7, top + 18, width - 14, obstacle.height - 18);
    ctx.fillRect(x + 3, top + 23, width - 6, obstacle.height - 23);
    ctx.fillRect(mid - 13, top + 9, 26, 17);
    ctx.fillRect(mid - 9, top + 3, 18, 12);
    ctx.fillRect(mid - 4, top, 8, 7);
    ctx.fillStyle = "#d78665";
    ctx.fillRect(x + 9, top + 22, width - 18, obstacle.height - 24);
    ctx.fillStyle = "#f7c87f";
    ctx.fillRect(mid - 11, top + 11, 22, 11);
    ctx.fillRect(mid - 7, top + 5, 14, 10);
    ctx.fillStyle = "#fff1d5";
    ctx.fillRect(mid - 3, top + 2, 6, 7);
    ctx.fillStyle = "#e86c93";
    ctx.fillRect(mid - 8, top + 15, 6, 3);
    ctx.fillRect(mid + 3, top + 10, 5, 3);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obstacle: SkyRunObstacle) {
  if (obstacle.objectType !== "GROUND_OBSTACLE") return;
  if (obstacle.worldIndex === 5) drawCandyObstacle(ctx, obstacle);
  else if (obstacle.kind === "crystal") drawSpireObstacle(ctx, obstacle);
  else if (obstacle.kind === "rune-pillar") drawColumnObstacle(ctx, obstacle);
  else drawMoundObstacle(ctx, obstacle);
}

function drawFinalPortal(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  if (snapshot.worldIndex !== 5) return;
  const distanceRemaining = SKY_RUN_TOTAL_DISTANCE - snapshot.distance;
  const portalRevealDistance = C.width - C.playerX + 58;
  if (distanceRemaining > portalRevealDistance || distanceRemaining < -118) return;

  const centerX = Math.round(C.playerX + distanceRemaining);
  const portalX = centerX - 47;
  const portalY = C.groundY - 174;
  const pulse = 0.72 + ((Math.sin(time * 4) + 1) / 2) * 0.28;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.shadowColor = "#fff0b8";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#fff0cf";
  ctx.fillRect(portalX + 17, portalY, 60, 8);
  ctx.fillRect(portalX + 8, portalY + 8, 10, 18);
  ctx.fillRect(portalX + 78, portalY + 8, 10, 18);
  ctx.fillRect(portalX + 2, portalY + 26, 10, 116);
  ctx.fillRect(portalX + 84, portalY + 26, 10, 116);
  ctx.fillRect(portalX + 10, portalY + 142, 74, 10);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#cf8d69";
  ctx.fillRect(portalX + 18, portalY + 8, 60, 6);
  ctx.fillRect(portalX + 12, portalY + 14, 6, 122);
  ctx.fillRect(portalX + 78, portalY + 14, 6, 122);
  ctx.fillRect(portalX + 18, portalY + 136, 60, 6);
  ctx.fillStyle = "#df719e";
  ctx.fillRect(portalX + 22, portalY + 13, 5, 12);
  ctx.fillRect(portalX + 67, portalY + 13, 5, 12);
  ctx.fillRect(portalX + 12, portalY + 36, 6, 8);
  ctx.fillRect(portalX + 78, portalY + 58, 6, 8);
  ctx.fillStyle = "#8b70c8";
  ctx.fillRect(portalX + 17, portalY + 26, 61, 108);

  const portalGlow = ctx.createLinearGradient(0, portalY + 29, 0, portalY + 132);
  portalGlow.addColorStop(0, "#ffd5e8");
  portalGlow.addColorStop(0.48, "#9eeaf1");
  portalGlow.addColorStop(1, "#c6a9ef");
  ctx.fillStyle = portalGlow;
  ctx.fillRect(portalX + 23, portalY + 32, 49, 96);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  ctx.fillRect(portalX + 31, portalY + 45, 4, 41);
  ctx.fillRect(portalX + 56, portalY + 84, 4, 31);
  ctx.fillStyle = "#fff3c5";
  ctx.fillRect(portalX + 43, portalY + 61, 8, 3);
  ctx.fillRect(portalX + 46, portalY + 58, 3, 9);
  ctx.fillStyle = "#fff7dc";
  ctx.fillRect(portalX + 43, portalY + 17, 8, 3);
  ctx.fillRect(portalX + 46, portalY + 14, 3, 9);

  for (let i = 0; i < 6; i++) {
    const angle = time * 1.2 + i * (Math.PI / 3);
    const x = centerX + Math.cos(angle) * (56 + (i % 2) * 5);
    const y = portalY + 76 + Math.sin(angle) * 75;
    ctx.globalAlpha = pulse * (0.55 + (i % 3) * 0.12);
    ctx.fillStyle = i % 2 === 0 ? "#fff5ca" : "#91e9ee";
    ctx.fillRect(Math.round(x), Math.round(y), 4, 4);
  }
  ctx.restore();
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, snapshot: SkyRunSnapshot, time: number) {
  if (snapshot.phase !== "playing") return;
  const progress = Math.min(
    1,
    Math.max(0, (snapshot.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1)),
  );
  if (progress <= 0) return;
  const activeCount = Math.min(SPEED_LINE_COUNT, 2 + Math.ceil(progress * (SPEED_LINE_COUNT - 2)));
  ctx.save();
  for (let i = 0; i < activeCount; i++) {
    const x = wrap(C.width - time * (160 + progress * 360) - i * 157, C.width);
    const y = 54 + ((i * 71 + 19) % (C.groundY - 90));
    ctx.globalAlpha = 0.035 + progress * 0.075;
    ctx.fillStyle = i % 3 === 0 ? "#dbd1ff" : "#d7faff";
    ctx.fillRect(Math.round(x), y, Math.round(5 + progress * 9), 2);
  }
  ctx.restore();
}

function drawCharacterParticle(
  ctx: CanvasRenderingContext2D,
  characterId: PlayableCharacterId,
  x: number,
  y: number,
  size: number,
  phase: number,
) {
  const colors = CHARACTER_FX[characterId];
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = phase % 2 === 0 ? colors.main : colors.light;

  if (characterId === "white-fox-ice-mage") {
    ctx.fillRect(px + 1, py, size, 2);
    ctx.fillRect(px + 2, py - 1, Math.max(1, size - 1), 4);
  } else if (characterId === "purple-rabbit-ninja") {
    ctx.fillRect(px + 1, py, 2, size + 2);
    ctx.fillRect(px, py + 1, size + 2, 2);
  } else if (characterId === "swamp-frog-mage") {
    ctx.fillRect(px + 1, py, size, 1);
    ctx.fillRect(px, py + 1, 1, size);
    ctx.fillRect(px + size + 1, py + 1, 1, size);
    ctx.fillRect(px + 1, py + size + 1, size, 1);
    ctx.fillRect(px + 2, py + 2, 1, 1);
  } else if (characterId === "forge-raccoon-mage") {
    ctx.fillRect(px + 1, py + size, size + 1, 2);
    ctx.fillRect(px + 2, py + 1, size, size);
    ctx.fillRect(px + 3, py, 1, 2);
  } else {
    ctx.fillRect(px, py, 1, size + 3);
    ctx.fillRect(px + 1, py + 1, size + 2, 1);
    ctx.fillRect(px + size, py + 2, 1, size);
    ctx.fillRect(px + 2, py + size + 1, size, 1);
  }
}

function drawRunnerTrail(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  characterId: PlayableCharacterId,
  time: number,
  playerX: number = C.playerX,
) {
  if (snapshot.phase !== "playing") return;
  const progress = Math.min(
    1,
    Math.max(0, (snapshot.speedMultiplier - 1) / (C.maxSpeedMultiplier - 1)),
  );
  const trailDistance = 30 + progress * 16;
  ctx.save();
  for (let i = 0; i < RUN_TRAIL_COUNT; i++) {
    const drift = wrap(time * (34 + progress * 72) + i * 19, 42);
    const x = playerX - trailDistance - drift;
    const y = C.groundY - 13 - (i % 2) * 11 + Math.round(Math.sin(time * 8 + i * 1.3) * 2);
    ctx.globalAlpha = 0.35 + ((i + Math.floor(time * 8)) % 3) * 0.13;
    drawCharacterParticle(ctx, characterId, x, y, i % 2 === 0 ? 2 : 1, i);
  }
  ctx.restore();
}

function drawJumpEffect(
  ctx: CanvasRenderingContext2D,
  characterId: PlayableCharacterId,
  kind: "takeoff" | "landing",
  progress: number,
  playerX: number = C.playerX,
) {
  if (progress < 0 || progress >= 1) return;
  const radius = 5 + progress * 21;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  for (const i of BURST_DIRECTIONS) {
    const angle = i * ((Math.PI * 2) / BURST_PARTICLE_COUNT);
    const x = playerX + Math.cos(angle) * radius;
    const vertical = Math.sin(angle) * radius * 0.34;
    const lift = kind === "takeoff" ? progress * 13 : -progress * 3;
    const y = C.groundY - 7 + vertical - lift;
    drawCharacterParticle(ctx, characterId, x, y, i % 2 === 0 ? 2 : 1, i);
  }
  ctx.restore();
}

export interface SkyRunVisualEffects {
  jumpKind: "takeoff" | "landing" | null;
  jumpProgress: number;
  showFinalPortal?: boolean;
}

function drawSkyRunCoin(
  ctx: CanvasRenderingContext2D,
  coin: { id: number; x: number; y: number },
  time: number,
) {
  const y = Math.round(coin.y + Math.sin(time * 4 + coin.id) * 2);
  ctx.save();
  ctx.shadowColor = "#ffe58a";
  ctx.shadowBlur = 11;
  ctx.fillStyle = "#98532d";
  ctx.fillRect(Math.round(coin.x) - 9, y - 10, 18, 20);
  ctx.fillStyle = "#e9a83d";
  ctx.fillRect(Math.round(coin.x) - 6, y - 11, 12, 22);
  ctx.fillStyle = "#ffdf73";
  ctx.fillRect(Math.round(coin.x) - 3, y - 8, 6, 16);
  ctx.fillStyle = "#fff7c9";
  ctx.fillRect(Math.round(coin.x) - 2, y - 7, 2, 5);
  ctx.restore();
}

export function drawSkyRunWorld(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  showFinalPortal = true,
) {
  ctx.imageSmoothingEnabled = false;

  if (snapshot.transitionFromWorldIndex !== null && snapshot.worldTransitionProgress < 1) {
    drawWorldLayer(ctx, snapshot, time, snapshot.transitionFromWorldIndex, 1);
    drawWorldLayer(ctx, snapshot, time, snapshot.worldIndex, snapshot.worldTransitionProgress);
  } else {
    drawWorldLayer(ctx, snapshot, time, snapshot.worldIndex, 1);
  }

  drawSpeedLines(ctx, snapshot, time);
  for (const obstacle of snapshot.obstacles) drawObstacle(ctx, obstacle);
  for (const coin of snapshot.coins) drawSkyRunCoin(ctx, coin, time);
  if (showFinalPortal) drawFinalPortal(ctx, snapshot, time);
}

export function drawSkyRunPlayerEffects(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  characterId: PlayableCharacterId,
  effects: SkyRunVisualEffects,
  playerX: number = C.playerX,
) {
  drawRunnerTrail(ctx, snapshot, characterId, time, playerX);
  if (effects.jumpKind) {
    drawJumpEffect(ctx, characterId, effects.jumpKind, effects.jumpProgress, playerX);
  }
}

export function drawSkyRun(
  ctx: CanvasRenderingContext2D,
  snapshot: SkyRunSnapshot,
  time: number,
  characterId: PlayableCharacterId,
  effects: SkyRunVisualEffects,
  playerX: number = C.playerX,
) {
  drawSkyRunWorld(ctx, snapshot, time, effects.showFinalPortal ?? true);
  drawSkyRunPlayerEffects(ctx, snapshot, time, characterId, effects, playerX);
}
