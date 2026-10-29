import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Matter from "matter-js";

import { Button } from "@/components/ui/button";

import { CurrencyRewardCard } from "../components/CurrencyRewardCard";
import { createMatchId, useMatchCurrencyRewards } from "../currency";
import { submitGlobalRecord } from "../leaderboard/api";
import { useArcadeAudio } from "../audio/ArcadeAudioProvider";
import { PixelSceneDecor } from "../components/PixelSceneDecor";
import { GameplaySprite } from "../gameplay/sprites/GameplaySprite";
import type { PlayableCharacterId } from "../types";
import { TOWER_CONFIG as C } from "./config";
import { getCharacterById } from "../data/characters";
import { BOT_LABELS, pickBotLineup, TowerBot } from "./bots";
import { TowerEngine, type PlacementRecommendation, type TowerSnapshot } from "./engine";
import { calculateTowerRewardBreakdown } from "./rewards";
import { TETROMINO_SHAPES, type TetrominoType } from "./pieces";
import { renderPiecePreview, renderTower } from "./render";
import { useTowerControls } from "./useTowerControls";
import { CharacterSwapModal, SwapHero } from "./CharacterSwap";
import { ShurikenFx } from "./ShurikenFx";
import { ForgePicker, ForgeSequence } from "./ForgeAbility";
import { WinCountdown } from "./WinCountdown";

interface TowerScreenProps {
  characterId: PlayableCharacterId | null;
  unlockedCharacterIds: PlayableCharacterId[];
  playerName: string;
  primaryWalletId: string;
  onBack: () => void;
  onChangeGame: () => void;
}

const TOWER_BEST_HEIGHT_KEY = "spellbound-tower-best-height-tenths-v1";

function readBestTowerHeightTenths() {
  try {
    const value = Number(window.localStorage.getItem(TOWER_BEST_HEIGHT_KEY));
    return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function TowerScreen({
  characterId: initialCharacterId,
  unlockedCharacterIds,
  playerName,
  primaryWalletId,
  onBack,
  onChangeGame,
}: TowerScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TowerEngine | null>(null);
  const { playSfx, setMusicIntensity } = useArcadeAudio();
  const [round, setRound] = useState(0);
  const matchSessionId = useRef(createMatchId("tower"));
  const tallestHeightTenthsRef = useRef(0);
  const [snap, setSnap] = useState<TowerSnapshot | null>(null);
  const audioRoundRef = useRef(round);
  const audioBestAtStartRef = useRef(readBestTowerHeightTenths());
  const audioRecordPlayedRef = useRef(false);
  const previousAudioSnapRef = useRef<TowerSnapshot | null>(null);
  // Bot lineup is fixed from the character chosen before the match (swapping never touches bots).
  const lineup = useMemo(() => pickBotLineup(initialCharacterId), [initialCharacterId]);
  const [characterId, setCharacterId] = useState<PlayableCharacterId | null>(initialCharacterId);
  const [swapOpen, setSwapOpen] = useState(false);
  const [aimingShuriken, setAimingShuriken] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [aimingFreeze, setAimingFreeze] = useState(false);
  const [freezeCooldown, setFreezeCooldown] = useState(0);
  const freezeUntilRef = useRef(0);
  const [aimingTongue, setAimingTongue] = useState(false);
  const [tongueCooldown, setTongueCooldown] = useState(0);
  const tongueUntilRef = useRef(0);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [forgingType, setForgingType] = useState<TetrominoType | null>(null);
  const [forgeCooldown, setForgeCooldown] = useState(0);
  const forgeUntilRef = useRef(0);
  const [timeVisionActive, setTimeVisionActive] = useState(false);
  const [timeVisionFading, setTimeVisionFading] = useState(false);
  const [timeVisionCooldown, setTimeVisionCooldown] = useState(0);
  const [capybaraCooldown, setCapybaraCooldown] = useState(0);
  const [timeVisionRecommendation, setTimeVisionRecommendation] =
    useState<PlacementRecommendation | null>(null);
  const timeVisionActiveRef = useRef(false);
  const timeVisionRecommendationRef = useRef<PlacementRecommendation | null>(null);
  const timeVisionUntilRef = useRef(0);
  const timeVisionTimeoutRef = useRef<number | null>(null);
  const timeVisionFadeUntilRef = useRef(0);
  const timeVisionFadeTimeoutRef = useRef<number | null>(null);
  const timeVisionCooldownUntilRef = useRef(0);
  const capybaraCooldownUntilRef = useRef(0);
  /** Piece currently held by the frog's tongue + chosen pull direction. */
  const tongueRef = useRef<{ body: Matter.Body; dir: Matter.Vector | null } | null>(null);
  const [tongueHeld, setTongueHeld] = useState(false);
  /** True while the engine is still dragging the grabbed piece. */
  const pullingRef = useRef(false);
  const [shurikenShot, setShurikenShot] = useState<{
    key: number;
    body: Matter.Body;
    x: number;
    y: number;
  } | null>(null);
  const [shurikenImpact, setShurikenImpact] = useState<{
    key: number;
    x: number;
    y: number;
  } | null>(null);
  const highlightedPieceRef = useRef<Matter.Body | null>(null);
  const cooldownUntilRef = useRef(0);
  const pausedRef = useRef(false);
  pausedRef.current =
    swapOpen ||
    aimingShuriken ||
    aimingFreeze ||
    aimingTongue ||
    (tongueHeld && !pullingRef.current) ||
    shurikenShot !== null ||
    forgeOpen ||
    forgingType !== null;
  const aimingFreezeRef = useRef(false);
  aimingFreezeRef.current = aimingFreeze;
  const aimingTongueRef = useRef(false);
  aimingTongueRef.current = aimingTongue;
  const botCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [botSnaps, setBotSnaps] = useState<(TowerSnapshot | null)[]>([null, null, null]);
  /** Participant indexes (0 = player, 1..3 = bots) in the order they reached the goal. */
  const [finishOrder, setFinishOrder] = useState<number[]>([]);

  const getEngine = useCallback(() => (pausedRef.current ? null : engineRef.current), []);
  useTowerControls(getEngine);

  const cancelShuriken = useCallback(() => {
    highlightedPieceRef.current = null;
    setAimingShuriken(false);
    setAimingFreeze(false);
    setAimingTongue(false);
    setForgeOpen(false);
    // Cancelling while holding: piece just goes back to normal physics, no pull.
    const held = tongueRef.current;
    if (held) engineRef.current?.releaseGrab(held.body, null, 0);
    pullingRef.current = false;
    tongueRef.current = null;
    setTongueHeld(false);
  }, []);

  const finishTimeVision = useCallback(() => {
    if (!timeVisionActiveRef.current) return;
    timeVisionActiveRef.current = false;
    if (timeVisionTimeoutRef.current !== null) {
      window.clearTimeout(timeVisionTimeoutRef.current);
      timeVisionTimeoutRef.current = null;
    }
    timeVisionUntilRef.current = 0;
    timeVisionRecommendationRef.current = null;
    setTimeVisionActive(false);
    setTimeVisionRecommendation(null);
    timeVisionFadeUntilRef.current = performance.now() + C.timeVisionFadeSeconds * 1000;
    setTimeVisionFading(true);
    if (timeVisionFadeTimeoutRef.current !== null)
      window.clearTimeout(timeVisionFadeTimeoutRef.current);
    timeVisionFadeTimeoutRef.current = window.setTimeout(() => {
      setTimeVisionFading(false);
      timeVisionFadeTimeoutRef.current = null;
    }, C.timeVisionFadeSeconds * 1000);
    timeVisionCooldownUntilRef.current = performance.now() + C.timeVisionCooldownSeconds * 1000;
    setTimeVisionCooldown(C.timeVisionCooldownSeconds);
  }, []);

  const toggleTimeVision = useCallback(() => {
    if (characterId !== "time-owl-mage") return;
    if (timeVisionCooldownUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    if (timeVisionActiveRef.current) {
      finishTimeVision();
      return;
    }
    const engine = engineRef.current;
    if (pausedRef.current || engine?.status !== "playing" || !engine.active) return;

    engine.softDrop = false;
    cancelShuriken();
    if (timeVisionFadeTimeoutRef.current !== null) {
      window.clearTimeout(timeVisionFadeTimeoutRef.current);
      timeVisionFadeTimeoutRef.current = null;
    }
    timeVisionFadeUntilRef.current = 0;
    setTimeVisionFading(false);
    timeVisionActiveRef.current = true;
    timeVisionUntilRef.current = performance.now() + C.timeVisionSeconds * 1000;
    const recommendation = engine.recommendActivePlacement();
    if (!recommendation) {
      timeVisionActiveRef.current = false;
      timeVisionUntilRef.current = 0;
      return;
    }

    timeVisionRecommendationRef.current = recommendation;
    setTimeVisionRecommendation(recommendation);
    setTimeVisionActive(true);
    playSfx("power-time");
    setTimeVisionCooldown(0);
    timeVisionTimeoutRef.current = window.setTimeout(
      finishTimeVision,
      Math.max(0, timeVisionUntilRef.current - performance.now()),
    );
  }, [cancelShuriken, characterId, finishTimeVision, playSfx]);

  const activateCapybaraMargin = useCallback(() => {
    if (characterId !== "calm-capybara-mage") return;
    if (capybaraCooldownUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    const engine = engineRef.current;
    if (pausedRef.current || engine?.status !== "playing" || !engine.active) return;
    if (!engine.activatePositioningMargin()) {
      playSfx("blocked");
      return;
    }
    engine.softDrop = false;
    capybaraCooldownUntilRef.current =
      performance.now() + C.capybaraMarginCooldownSeconds * 1000;
    setCapybaraCooldown(C.capybaraMarginCooldownSeconds);
    setSnap(engine.snapshot());
    playSfx("power-time");
  }, [characterId, playSfx]);

  const toggleForge = useCallback(() => {
    if (characterId !== "forge-raccoon-mage" || forgingType) return;
    if (forgeUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    if (forgeOpen) {
      setForgeOpen(false);
      return;
    }
    if (engineRef.current?.status !== "playing" || !engineRef.current.active) return;
    engineRef.current.softDrop = false;
    cancelShuriken();
    setForgeOpen(true);
  }, [cancelShuriken, characterId, forgeOpen, forgingType, playSfx]);

  const chooseForgePiece = useCallback(
    (type: TetrominoType) => {
      if (characterId !== "forge-raccoon-mage" || !forgeOpen || !engineRef.current?.active) return;
      setForgeOpen(false);
      setForgingType(type);
    },
    [characterId, forgeOpen],
  );

  const toggleTongue = useCallback(() => {
    if (characterId !== "swamp-frog-mage") return;
    if (tongueUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    if (aimingTongue || tongueRef.current) {
      cancelShuriken();
      return;
    }
    if (engineRef.current?.status !== "playing") return;
    engineRef.current.softDrop = false;
    setAimingTongue(true);
  }, [aimingTongue, cancelShuriken, characterId, playSfx]);

  const toggleFreeze = useCallback(() => {
    if (characterId !== "white-fox-ice-mage") return;
    if (freezeUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    if (aimingFreeze) {
      cancelShuriken();
      return;
    }
    if (engineRef.current?.status !== "playing") return;
    engineRef.current.softDrop = false;
    setAimingFreeze(true);
  }, [aimingFreeze, cancelShuriken, characterId, playSfx]);

  const toggleShuriken = useCallback(() => {
    if (characterId !== "purple-rabbit-ninja" || shurikenShot) return;
    if (cooldownUntilRef.current > performance.now()) {
      playSfx("blocked");
      return;
    }
    if (aimingShuriken) {
      cancelShuriken();
      return;
    }
    if (engineRef.current?.status !== "playing") return;
    if (engineRef.current) engineRef.current.softDrop = false;
    setAimingShuriken(true);
  }, [aimingShuriken, cancelShuriken, characterId, playSfx, shurikenShot]);

  const openSwap = useCallback(() => {
    if (engineRef.current) engineRef.current.softDrop = false;
    finishTimeVision();
    cancelShuriken();
    setSwapOpen(true);
  }, [cancelShuriken, finishTimeVision]);
  const pickCharacter = useCallback(
    (id: PlayableCharacterId) => {
      if (!unlockedCharacterIds.includes(id)) return;
      finishTimeVision();
      cancelShuriken();
      const engine = engineRef.current;
      if (id !== "calm-capybara-mage") engine?.cancelPositioningMargin();
      engine?.setMaxLostPieces(
        id === "axolotl-mage" ? C.axolotlMaxLostPieces : C.maxLostPieces,
      );
      if (engine) setSnap(engine.snapshot());
      setSwapOpen(false);
      setCharacterId(id);
    },
    [cancelShuriken, finishTimeVision, unlockedCharacterIds],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.repeat) return;
        if (swapOpen) setSwapOpen(false);
        else openSwap();
      } else if (e.key.toLowerCase() === "z") {
        if (e.repeat || swapOpen) return;
        e.preventDefault();
        if (characterId === "time-owl-mage") toggleTimeVision();
        else if (characterId === "calm-capybara-mage") activateCapybaraMargin();
        else if (characterId === "white-fox-ice-mage") toggleFreeze();
        else if (characterId === "swamp-frog-mage") toggleTongue();
        else if (characterId === "forge-raccoon-mage") toggleForge();
        else toggleShuriken();
      } else if (
        e.key === "Escape" &&
        (swapOpen ||
          aimingShuriken ||
          aimingFreeze ||
          aimingTongue ||
          tongueHeld ||
          forgeOpen ||
          timeVisionActive)
      ) {
        e.preventDefault();
        setSwapOpen(false);
        finishTimeVision();
        cancelShuriken();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    aimingFreeze,
    aimingShuriken,
    aimingTongue,
    activateCapybaraMargin,
    cancelShuriken,
    characterId,
    forgeOpen,
    finishTimeVision,
    openSwap,
    swapOpen,
    timeVisionActive,
    tongueHeld,
    toggleForge,
    toggleFreeze,
    toggleShuriken,
    toggleTimeVision,
    toggleTongue,
  ]);

  useEffect(() => {
    finishTimeVision();
    cancelShuriken();
  }, [cancelShuriken, characterId, finishTimeVision]);

  const isShurikenCooldownActive = cooldown > 0;
  const isTongueCooldownActive = tongueCooldown > 0;
  const isFreezeCooldownActive = freezeCooldown > 0;
  const isForgeCooldownActive = forgeCooldown > 0;
  const isTimeVisionCooldownActive = timeVisionCooldown > 0;
  const isCapybaraCooldownActive = capybaraCooldown > 0;
  const previousCooldownStateRef = useRef([false, false, false, false, false, false]);

  useEffect(() => {
    const current = [
      isShurikenCooldownActive,
      isTongueCooldownActive,
      isFreezeCooldownActive,
      isForgeCooldownActive,
      isTimeVisionCooldownActive,
      isCapybaraCooldownActive,
    ];
    const finished = current.some(
      (active, index) => previousCooldownStateRef.current[index] && !active,
    );
    if (finished) playSfx("cooldown-ready");
    previousCooldownStateRef.current = current;
  }, [
    isForgeCooldownActive,
    isFreezeCooldownActive,
    isShurikenCooldownActive,
    isTimeVisionCooldownActive,
    isCapybaraCooldownActive,
    isTongueCooldownActive,
    playSfx,
  ]);

  useEffect(() => {
    if (!isShurikenCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, (cooldownUntilRef.current - performance.now()) / 1000);
      setCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isShurikenCooldownActive]);

  useEffect(() => {
    if (!isTongueCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, (tongueUntilRef.current - performance.now()) / 1000);
      setTongueCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isTongueCooldownActive]);

  useEffect(() => {
    if (!isFreezeCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, (freezeUntilRef.current - performance.now()) / 1000);
      setFreezeCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isFreezeCooldownActive]);

  useEffect(() => {
    if (!isForgeCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, (forgeUntilRef.current - performance.now()) / 1000);
      setForgeCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isForgeCooldownActive]);

  useEffect(() => {
    if (!isTimeVisionCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        (timeVisionCooldownUntilRef.current - performance.now()) / 1000,
      );
      setTimeVisionCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isTimeVisionCooldownActive]);

  useEffect(() => {
    if (!isCapybaraCooldownActive) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(
        0,
        (capybaraCooldownUntilRef.current - performance.now()) / 1000,
      );
      setCapybaraCooldown(remaining);
      if (remaining <= 0) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [isCapybaraCooldownActive]);

  useEffect(
    () => () => {
      if (timeVisionTimeoutRef.current !== null) window.clearTimeout(timeVisionTimeoutRef.current);
      if (timeVisionFadeTimeoutRef.current !== null)
        window.clearTimeout(timeVisionFadeTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!forgingType) return;
    const type = forgingType;
    const timer = window.setTimeout(() => {
      const forged = engineRef.current?.forgeActivePiece(type, C.forgedHeatSeconds);
      setForgingType(null);
      if (!forged) return;
      playSfx("power-forge");
      forgeUntilRef.current = performance.now() + C.forgeCooldownSeconds * 1000;
      setForgeCooldown(C.forgeCooldownSeconds);
    }, C.forgeAnimationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [forgingType, playSfx]);

  useEffect(() => {
    if (!shurikenShot) return;
    const timer = window.setTimeout(() => {
      engineRef.current?.removePlacedPiece(shurikenShot.body);
      setShurikenImpact({ key: shurikenShot.key, x: shurikenShot.x, y: shurikenShot.y });
      highlightedPieceRef.current = null;
      setShurikenShot(null);
    }, C.shurikenFlightSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [shurikenShot]);

  useEffect(() => {
    if (!shurikenImpact) return;
    const timer = window.setTimeout(() => setShurikenImpact(null), 480);
    return () => window.clearTimeout(timer);
  }, [shurikenImpact]);

  useEffect(() => {
    const engine = new TowerEngine(
      initialCharacterId === "axolotl-mage" ? C.axolotlMaxLostPieces : C.maxLostPieces,
    );
    engineRef.current = engine;
    const bots = lineup.map((b) => new TowerBot(new TowerEngine(), b.difficulty));
    const botCtxs = bots.map((_, i) => botCanvasRefs.current[i]?.getContext("2d") ?? null);
    const botEngines = bots.map((bot) => bot.engine);
    const all = [engine, ...botEngines];
    const done = new Set<number>();
    setFinishOrder([]);
    setBotSnaps([null, null, null]);
    const ctx = canvasRef.current?.getContext("2d");
    let raf = 0;
    let last = performance.now();
    let sceneTime = 0;
    let lastKey = "";
    const botKeys = ["", "", ""];

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const timeFrozen = timeVisionActiveRef.current;
      const timeFreezeFade = timeFrozen
        ? 0
        : Math.max(0, (timeVisionFadeUntilRef.current - now) / (C.timeVisionFadeSeconds * 1000));
      if (!timeFrozen) sceneTime += dt;
      // While the tongue is mid-pull the engine must keep stepping so the drag animates.
      if (timeFrozen) {
        engine.stepControlledPiece(dt);
        if (!engine.active || now >= timeVisionUntilRef.current) finishTimeVision();
      } else if (!pausedRef.current || pullingRef.current) engine.step(dt);
      if (pullingRef.current && tongueRef.current && !engine.isPulling(tongueRef.current.body)) {
        pullingRef.current = false;
        tongueRef.current = null;
        setTongueHeld(false);
      }
      if (ctx)
        renderTower(ctx, engine, sceneTime, {
          highlightedPiece: highlightedPieceRef.current,
          highlightIce: aimingFreezeRef.current,
          highlightColor: aimingTongueRef.current ? "#8ef0a2" : undefined,
          tongue: tongueRef.current ? { ...tongueRef.current, reach: C.tonguePull } : null,
          showLandingGuide: true,
          timeFrozen,
          timeVision: timeFrozen ? timeVisionRecommendationRef.current : null,
          effectTime: now / 1000,
          timeFreezeFade,
        });
      bots.forEach((bot, i) => {
        if (!timeFrozen) {
          bot.update(dt);
          bot.engine.step(dt);
        }
        // Resolve elimination victory in this same frame, before finish order is recorded.
        engine.awardEliminationVictoryIfAllBotsLost(botEngines);
        const bctx = botCtxs[i];
        if (bctx)
          renderTower(bctx, bot.engine, sceneTime, {
            timeFrozen,
            effectTime: now / 1000,
            timeFreezeFade,
          });
        const bs = bot.engine.snapshot();
        const bk = `${bs.status}|${bs.heightMeters}|${bs.lostPieces}|${bs.winConfirming}|${Math.ceil(bs.winSecondsRemaining)}`;
        if (bk !== botKeys[i]) {
          botKeys[i] = bk;
          setBotSnaps((prev) => prev.map((p, j) => (j === i ? bs : p)));
        }
      });
      all.forEach((e, i) => {
        if (e.status === "won" && !done.has(i)) {
          done.add(i);
          setFinishOrder((o) => [...o, i]);
        }
      });
      const s = engine.snapshot();
      tallestHeightTenthsRef.current = Math.max(
        tallestHeightTenthsRef.current,
        Math.max(0, Math.round(s.heightMeters * 10)),
      );
      const key = `${s.status}|${s.heightMeters}|${s.lostPieces}|${s.nextType}|${s.placed}|${s.stablePieces}|${s.winConfirming}|${Math.ceil(s.winSecondsRemaining)}`;
      if (key !== lastKey) {
        lastKey = key;
        setSnap(s);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.destroy();
      bots.forEach((b) => b.engine.destroy());
      engineRef.current = null;
    };
  }, [finishTimeVision, round, lineup]);

  useEffect(() => {
    const ctx = nextRef.current?.getContext("2d");
    if (ctx && snap) renderPiecePreview(ctx, snap.nextType, TETROMINO_SHAPES[snap.nextType]);
  }, [snap?.nextType, snap]);

  const status = snap?.status ?? "playing";
  const matchOver = status !== "playing" && botSnaps.every((b) => b && b.status !== "playing");
  const matchId = `${matchSessionId.current}:${round}`;
  const currentHeightMeters = snap?.heightMeters;
  const playerHasFinished = snap !== null && snap.status !== "playing";
  const rewardBreakdown = calculateTowerRewardBreakdown({
    status,
    peakHeightTenths: tallestHeightTenthsRef.current,
    stablePieces: snap?.stablePieces ?? 0,
  });

  useEffect(() => {
    if (!playerHasFinished) return;
    const bestHeightTenths = tallestHeightTenthsRef.current;
    if (bestHeightTenths <= readBestTowerHeightTenths()) return;
    try {
      window.localStorage.setItem(TOWER_BEST_HEIGHT_KEY, String(bestHeightTenths));
    } catch {
      // The match remains playable if browser storage is unavailable.
    }
    void submitGlobalRecord("tower", bestHeightTenths);
  }, [currentHeightMeters, playerHasFinished]);

  const rewardReceipts = useMatchCurrencyRewards(
    matchId,
    matchOver && snap
      ? [
          {
            walletId: primaryWalletId,
            playerId: "player-1",
            playerName,
            amount: rewardBreakdown.total,
          },
        ]
      : [],
    primaryWalletId,
  );
  const participants = [
    { idx: 0, characterId, label: playerName.toUpperCase(), snap },
    ...lineup.map((b, i) => ({
      idx: i + 1,
      characterId: b.characterId,
      label: `BOT ${BOT_LABELS[b.difficulty]}`,
      snap: botSnaps[i],
    })),
  ];
  const ranking = [
    ...finishOrder.map((i) => participants[i]!),
    ...participants
      .filter((p) => !finishOrder.includes(p.idx))
      .sort((a, b) => (b.snap?.heightMeters ?? 0) - (a.snap?.heightMeters ?? 0)),
  ];
  const playerPlace = finishOrder.indexOf(0) + 1;
  const height = snap?.heightMeters ?? 0;
  const lostCount = snap?.lostPieces ?? 0;
  const maxLostPieces =
    snap?.maxLostPieces ??
    (characterId === "axolotl-mage" ? C.axolotlMaxLostPieces : C.maxLostPieces);
  const stablePieceCount = snap?.stablePieces ?? 0;

  useEffect(() => {
    if (audioRoundRef.current !== round) {
      audioRoundRef.current = round;
      audioBestAtStartRef.current = readBestTowerHeightTenths();
      audioRecordPlayedRef.current = false;
      previousAudioSnapRef.current = null;
      return;
    }
    if (!snap) return;

    const previous = previousAudioSnapRef.current;
    if (!previous) {
      previousAudioSnapRef.current = snap;
      if (snap.status === "playing") playSfx("game-start");
      return;
    }
    if (snap.placed > previous.placed) playSfx("piece-drop");
    if (snap.lostPieces > previous.lostPieces) playSfx("hit");
    const bestHeightTenths = Math.max(0, Math.round(snap.heightMeters * 10));
    if (bestHeightTenths > audioBestAtStartRef.current && !audioRecordPlayedRef.current) {
      audioRecordPlayedRef.current = true;
      playSfx("record");
    }
    if (previous.status === "playing" && snap.status === "won") playSfx("win");
    if (previous.status === "playing" && snap.status === "lost") playSfx("game-over");
    previousAudioSnapRef.current = snap;
  }, [playSfx, round, snap]);

  const arenaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (lostCount > 0) {
      arenaRef.current?.animate(
        [
          { transform: "translate(0,0)" },
          { transform: "translate(-4px,2px)" },
          { transform: "translate(4px,-2px)" },
          { transform: "translate(-2px,1px)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 300, easing: "steps(5)" },
      );
    }
  }, [lostCount]);
  const progress = Math.min(1, height / C.goalMeters);
  const heroAnim = status === "won" ? "victory" : status === "lost" ? "defeat" : "idle";
  const heightIntensityBand = Math.floor(progress * 4);

  useEffect(() => {
    const intensity =
      status === "playing"
        ? 0.9 + heightIntensityBand * 0.045 + Math.min(lostCount * 0.015, 0.075)
        : 0.92;
    setMusicIntensity(intensity);
  }, [heightIntensityBand, lostCount, setMusicIntensity, status]);

  useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);

  const pointerPosition = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * C.width,
      y: ((event.clientY - rect.top) / rect.height) * C.height,
    };
  }, []);

  const aimAtPointer = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const held = tongueRef.current;
      if (held) {
        const point = pointerPosition(event);
        if (point) {
          const dx = point.x - held.body.position.x;
          const dy = point.y - held.body.position.y;
          held.dir = Math.hypot(dx, dy) > 6 ? { x: dx, y: dy } : null;
        }
        return;
      }
      if ((!aimingShuriken && !aimingFreeze && !aimingTongue) || shurikenShot) return;
      const point = pointerPosition(event);
      highlightedPieceRef.current =
        point && engineRef.current ? engineRef.current.getPlacedPieceAt(point) : null;
    },
    [aimingFreeze, aimingShuriken, aimingTongue, pointerPosition, shurikenShot],
  );

  const castFreeze = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = pointerPosition(event);
      const engine = engineRef.current;
      const body = point && engine ? engine.getPlacedPieceAt(point) : null;
      if (!body || !engine?.freezePiece(body, C.freezeSeconds)) return;
      playSfx("power-ice");
      highlightedPieceRef.current = null;
      setAimingFreeze(false);
      freezeUntilRef.current = performance.now() + C.freezeCooldownSeconds * 1000;
      setFreezeCooldown(C.freezeCooldownSeconds);
    },
    [playSfx, pointerPosition],
  );

  const fireShuriken = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (aimingFreeze) return castFreeze(event);
      if (tongueRef.current) {
        // Second click confirms the short pull, then the piece is released to physics.
        const held = tongueRef.current;
        if (!held.dir) return;
        engineRef.current?.releaseGrab(held.body, held.dir, C.tonguePull);
        playSfx("power-swamp");
        // Keep the tongue visual until the engine finishes the drag.
        pullingRef.current = true;
        tongueUntilRef.current = performance.now() + C.tongueCooldownSeconds * 1000;
        setTongueCooldown(C.tongueCooldownSeconds);
        return;
      }
      if (aimingTongue) {
        const point = pointerPosition(event);
        const engine = engineRef.current;
        const body = point && engine ? engine.getPlacedPieceAt(point) : null;
        if (!body || !engine?.grabPiece(body)) return;
        highlightedPieceRef.current = null;
        tongueRef.current = { body, dir: null };
        setAimingTongue(false);
        setTongueHeld(true);
        return;
      }
      if (!aimingShuriken || shurikenShot) return;
      const point = pointerPosition(event);
      const body = point && engineRef.current ? engineRef.current.getPlacedPieceAt(point) : null;
      if (!body) return;
      playSfx("power-shuriken");
      const shot = {
        key: Date.now(),
        body,
        x: (body.position.x / C.width) * 100,
        y: (body.position.y / C.height) * 100,
      };
      highlightedPieceRef.current = null;
      setAimingShuriken(false);
      setShurikenShot(shot);
      cooldownUntilRef.current = performance.now() + C.shurikenCooldownSeconds * 1000;
      setCooldown(C.shurikenCooldownSeconds);
    },
    [
      aimingFreeze,
      aimingShuriken,
      aimingTongue,
      castFreeze,
      playSfx,
      pointerPosition,
      shurikenShot,
    ],
  );

  const touch = (fn: (e: TowerEngine) => void) => () => {
    const e = getEngine();
    if (e) fn(e);
  };

  return (
    <main className="celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6">
      <PixelSceneDecor />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-3">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-arcade text-[0.55rem] text-arcade-violet">MAGISTERIUM ARCADE</p>
            <h1 className="pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl">
              TOWER
            </h1>
          </div>
          <Button type="button" variant="arcade" size="arcade" onClick={onBack}>
            VOLTAR ÀS OPÇÕES
          </Button>
        </header>

        <div className="overflow-x-auto pb-2">
          <section
            className="relative grid min-w-[960px] grid-cols-4 items-start gap-2"
            aria-label="Torres da partida"
          >
            <div
              ref={arenaRef}
              className="pixel-panel relative flex min-w-0 flex-col gap-1 rounded-sm border-arcade-cyan p-1.5 ring-2 ring-arcade-cyan/60"
            >
              <div className="flex min-h-8 items-center gap-1">
                {characterId && (
                  <GameplaySprite
                    characterId={characterId}
                    animation={
                      shurikenShot || forgingType || timeVisionActive ? "ability" : heroAnim
                    }
                    size={24}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-arcade text-[0.5rem] text-arcade-ink">VOCÊ</p>
                  <p className="font-arcade text-[0.38rem] text-arcade-violet">
                    {height.toFixed(1)} / {C.goalMeters} m · {lostCount}/{maxLostPieces} ·{" "}
                    {stablePieceCount} estáveis · 🪙 {stablePieceCount * 5}
                  </p>
                </div>
              </div>
              {lostCount > 0 && (
                <Fragment key={`lost-${lostCount}`}>
                  <div
                    className="tower-flash pointer-events-none absolute inset-0 z-10"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.6), rgba(94,230,255,0.35) 60%, rgba(122,78,200,0.45))",
                    }}
                    aria-hidden="true"
                  />
                  <p
                    className="tower-lost-pop pointer-events-none absolute left-1/2 top-[45%] z-10 whitespace-nowrap border-2 border-arcade-panel-border bg-arcade-panel px-3 py-2 font-arcade text-[0.6rem] text-arcade-violet sm:text-xs"
                    role="status"
                  >
                    ✦ PEÇA PERDIDA! {lostCount}/{maxLostPieces} ✦
                  </p>
                </Fragment>
              )}
              <div
                className="relative mx-auto w-full max-w-[calc(64vh*400/720)]"
                style={{ aspectRatio: `${C.width} / ${C.height}` }}
              >
                <canvas
                  ref={canvasRef}
                  width={C.width}
                  height={C.height}
                  className={`block h-full w-full [image-rendering:pixelated] ${aimingShuriken || aimingFreeze || aimingTongue || tongueHeld ? "cursor-crosshair" : ""}`}
                  onPointerMove={aimAtPointer}
                  onPointerLeave={() => {
                    highlightedPieceRef.current = null;
                  }}
                  onPointerDown={fireShuriken}
                />
                <WinCountdown snapshot={snap} />
                {shurikenShot && (
                  <ShurikenFx
                    shotKey={shurikenShot.key}
                    target={{ x: shurikenShot.x, y: shurikenShot.y }}
                    phase="flight"
                  />
                )}
                {shurikenImpact && (
                  <ShurikenFx
                    shotKey={shurikenImpact.key}
                    target={{ x: shurikenImpact.x, y: shurikenImpact.y }}
                    phase="impact"
                  />
                )}
                {forgingType && <ForgeSequence type={forgingType} />}
              </div>
              {characterId && (
                <div
                  className={`pointer-events-none absolute bottom-[8%] left-[3%] z-20 relative transition-all duration-300 ${timeVisionActive ? "drop-shadow-[0_0_10px_#b58cff]" : ""}`}
                >
                  {(timeVisionActive || timeVisionFading) && (
                    <>
                      <span
                        className={`absolute -inset-2 rounded-full border-2 border-arcade-lilac/80 shadow-[0_0_14px_#b58cff] animate-pulse transition-opacity duration-300 ${timeVisionActive ? "opacity-100" : "opacity-0"}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`absolute -right-1 -top-2 font-arcade text-[0.5rem] text-arcade-lilac [text-shadow:0_0_6px_#b58cff] transition-opacity duration-300 ${timeVisionActive ? "opacity-100" : "opacity-0"}`}
                        aria-hidden="true"
                      >
                        ⧗
                      </span>
                    </>
                  )}
                  <SwapHero
                    characterId={characterId}
                    animation={shurikenShot ? "idle" : heroAnim}
                    size={46}
                  />
                </div>
              )}
              {aimingShuriken && (
                <p className="pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-violet bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink">
                  CLIQUE EM UMA PEÇA PARA DESTRUÍ-LA!
                </p>
              )}
              {(aimingTongue || tongueHeld) && (
                <p className="pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-cyan bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink">
                  {tongueHeld ? "MIRE A DIREÇÃO E CLIQUE PARA PUXAR!" : "PUXE UMA PEÇA!"}
                </p>
              )}
              {aimingFreeze && (
                <p className="pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-cyan bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink">
                  CONGELE UMA PEÇA!
                </p>
              )}
              {timeVisionActive && (
                <p
                  className="pointer-events-none absolute inset-x-2 top-20 z-20 border-2 border-arcade-lilac bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.42rem] leading-relaxed text-arcade-violet"
                  role="status"
                >
                  ⧗ TEMPO CONGELADO ·{" "}
                  {timeVisionRecommendation?.quarterTurns
                    ? `GIRE ${timeVisionRecommendation.quarterTurns}×`
                    : "SEM GIRO"}{" "}
                  · MOVER / ESPAÇO SOLTA
                </p>
              )}
              {!matchOver && (
                <Button
                  type="button"
                  onClick={openSwap}
                  variant="arcadePanel"
                  className="absolute left-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem]"
                  aria-label="Trocar personagem (TAB)"
                >
                  <span className="text-arcade-violet">TAB</span> | ⇄ TROCAR
                </Button>
              )}
              {swapOpen && !matchOver && (
                <CharacterSwapModal
                  current={characterId}
                  unlockedCharacterIds={unlockedCharacterIds}
                  onPick={(id) => (id === characterId ? setSwapOpen(false) : pickCharacter(id))}
                  onClose={() => setSwapOpen(false)}
                />
              )}

              {forgeOpen && characterId === "forge-raccoon-mage" && !matchOver && (
                <ForgePicker onPick={chooseForgePiece} onCancel={() => setForgeOpen(false)} />
              )}

              {characterId === "time-owl-mage" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${timeVisionActive ? "ring-2 ring-arcade-lilac shadow-[0_0_10px_#b58cff]" : ""}`}
                  onClick={toggleTimeVision}
                  disabled={timeVisionCooldown > 0 && !timeVisionActive}
                  aria-pressed={timeVisionActive}
                  aria-label="Visão do Tempo: prever posição da peça"
                >
                  Z |{" "}
                  {timeVisionCooldown > 0
                    ? `${timeVisionCooldown.toFixed(1)}s`
                    : timeVisionActive
                      ? "CANCELAR"
                      : "PREVER"}
                </Button>
              )}

              {characterId === "calm-capybara-mage" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${snap?.positioningMarginState ? "ring-2 ring-arcade-cyan shadow-[0_0_10px_#60e2ff]" : ""}`}
                  onClick={activateCapybaraMargin}
                  disabled={capybaraCooldown > 0 || snap?.positioningMarginState !== null}
                  aria-label="Capivara: ampliar a margem de posicionamento da próxima peça"
                >
                  Z | {capybaraCooldown > 0 ? `${capybaraCooldown.toFixed(1)}s` : snap?.positioningMarginState ? "ATIVA" : "ENCAIXE"}
                </Button>
              )}

              {characterId === "purple-rabbit-ninja" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingShuriken ? "ring-2 ring-arcade-violet" : ""}`}
                  onClick={toggleShuriken}
                  disabled={cooldown > 0 || shurikenShot !== null}
                  aria-pressed={aimingShuriken}
                >
                  Z |{" "}
                  {cooldown > 0
                    ? `${cooldown.toFixed(1)}s`
                    : aimingShuriken
                      ? "CANCELAR"
                      : "SHURIKEN"}
                </Button>
              )}

              {characterId === "white-fox-ice-mage" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingFreeze ? "ring-2 ring-arcade-cyan" : ""}`}
                  onClick={toggleFreeze}
                  disabled={freezeCooldown > 0}
                  aria-pressed={aimingFreeze}
                >
                  Z |{" "}
                  {freezeCooldown > 0
                    ? `${freezeCooldown.toFixed(1)}s`
                    : aimingFreeze
                      ? "CANCELAR"
                      : "CONGELAR"}
                </Button>
              )}

              {characterId === "swamp-frog-mage" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingTongue || tongueHeld ? "ring-2 ring-arcade-cyan" : ""}`}
                  onClick={toggleTongue}
                  disabled={tongueCooldown > 0}
                  aria-pressed={aimingTongue || tongueHeld}
                >
                  Z |{" "}
                  {tongueCooldown > 0
                    ? `${tongueCooldown.toFixed(1)}s`
                    : aimingTongue || tongueHeld
                      ? "CANCELAR"
                      : "LÍNGUA"}
                </Button>
              )}

              {characterId === "forge-raccoon-mage" && !matchOver && (
                <Button
                  type="button"
                  variant="arcadePanel"
                  className={`absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${forgeOpen || forgingType ? "ring-2 ring-forge-hot" : ""}`}
                  onClick={toggleForge}
                  disabled={forgeCooldown > 0 || forgingType !== null}
                  aria-pressed={forgeOpen}
                >
                  Z |{" "}
                  {forgeCooldown > 0
                    ? `${forgeCooldown.toFixed(1)}s`
                    : forgingType
                      ? "FORJANDO"
                      : forgeOpen
                        ? "CANCELAR"
                        : "FORJAR"}
                </Button>
              )}

              {status !== "playing" && !matchOver && (
                <div className="pointer-events-none absolute inset-x-2 top-16 z-10 flex justify-center">
                  <p className="border-2 border-arcade-panel-border bg-arcade-panel px-3 py-2 text-center font-arcade text-[0.55rem] text-arcade-violet sm:text-xs">
                    {status === "won"
                      ? `✦ VOCÊ CHEGOU EM ${playerPlace}º! ✦`
                      : "VOCÊ FOI ELIMINADO"}
                    <br />
                    <span className="text-arcade-ink">AGUARDANDO OS BOTS...</span>
                  </p>
                </div>
              )}

              <div className="h-2 border border-arcade-cyan bg-arcade-sky/30">
                <div
                  className="h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>

            {lineup.map((b, i) => (
              <BotCard
                key={b.characterId}
                characterId={b.characterId}
                botNumber={i + 1}
                label={BOT_LABELS[b.difficulty]}
                snap={botSnaps[i] ?? null}
                place={finishOrder.indexOf(i + 1) + 1}
                canvasRef={(el) => (botCanvasRefs.current[i] = el)}
              />
            ))}

            {matchOver && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-arcade-ink/40 p-4">
                {playerPlace === 1 && (
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 18 }).map((_, i) => (
                      <span
                        key={i}
                        className="twinkle absolute h-2 w-2 bg-arcade-cyan"
                        style={{
                          left: `${(i * 37) % 100}%`,
                          top: `${(i * 23) % 90}%`,
                          animationDelay: `${(i % 6) * 0.2}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="pixel-panel relative flex flex-col items-center gap-4 rounded-sm p-5 text-center animate-scale-in">
                  {playerPlace > 0 && (
                    <p className="font-arcade text-[0.6rem] text-arcade-violet sm:text-xs">
                      ✦ TORRE CONCLUÍDA! ✦
                    </p>
                  )}
                  <h2 className="pixel-title text-xl leading-relaxed text-arcade-ink sm:text-2xl">
                    {playerPlace === 1
                      ? "VOCÊ VENCEU!"
                      : playerPlace > 0
                        ? `VOCÊ FICOU EM ${playerPlace}º!`
                        : "A TORRE DESABOU!"}
                  </h2>
                  <ol className="w-full space-y-1 text-left">
                    {ranking.map((p, i) => {
                      const ch = getCharacterById(p.characterId ?? null);
                      const finished = finishOrder.includes(p.idx);
                      return (
                        <li
                          key={p.idx}
                          className={`flex items-center gap-2 border-2 px-2 py-1 font-arcade text-[0.55rem] ${p.idx === 0 ? "border-arcade-violet bg-arcade-lilac/40" : "border-arcade-panel-border bg-arcade-sky/20"} text-arcade-ink`}
                        >
                          <span className="w-6">{i + 1}º</span>
                          {p.characterId && (
                            <GameplaySprite
                              characterId={p.characterId}
                              animation={finished ? "victory" : "defeat"}
                              size={24}
                            />
                          )}
                          <span className="flex-1">
                            {ch?.shortName ?? "VOCÊ"} · {p.label}
                          </span>
                          <span className="text-arcade-violet">
                            {finished ? "✦" : `${(p.snap?.heightMeters ?? 0).toFixed(1)} m`}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <div className="w-full border-t-2 border-arcade-panel-border pt-2 text-left font-game text-xs text-arcade-ink">
                    <p>
                      PEÇAS ESTÁVEIS ({stablePieceCount} × 5): +
                      {rewardBreakdown.stablePieceBonus.toLocaleString("pt-BR")} 🪙
                    </p>
                    <p>
                      ALTURA MÁXIMA (1 🪙/m): +{rewardBreakdown.heightBonus.toLocaleString("pt-BR")}{" "}
                      🪙
                    </p>
                    <p>
                      BÔNUS DE VITÓRIA: +{rewardBreakdown.victoryBonus.toLocaleString("pt-BR")} 🪙
                    </p>
                  </div>
                  <CurrencyRewardCard receipts={rewardReceipts} />
                  <Button
                    type="button"
                    variant="arcade"
                    size="arcade"
                    onClick={() => {
                      tallestHeightTenthsRef.current = 0;
                      setSnap(null);
                      setBotSnaps([null, null, null]);
                      setFinishOrder([]);
                      setRound((r) => r + 1);
                    }}
                    aria-label="Votar por revanche e jogar novamente com a mesma sala"
                  >
                    REVANCHE
                  </Button>
                  <Button
                    type="button"
                    variant="arcadePanel"
                    size="arcade"
                    onClick={onChangeGame}
                    aria-label="Votar por mudar de jogo e voltar à seleção de minigames"
                  >
                    MUDAR DE JOGO
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="grid w-full grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1.3fr]">
          <div
            className={`pixel-panel flex-1 rounded-sm p-3 ${progress >= 0.8 && status === "playing" ? "ring-4 ring-arcade-cyan animate-pulse" : ""}`}
          >
            <p className="font-arcade text-xs text-arcade-violet">ALTURA</p>
            <p className="pixel-title whitespace-nowrap text-3xl leading-snug text-arcade-ink">
              {height.toFixed(1)}
              <span className="text-lg"> m</span>
            </p>
            <div className="mt-2 h-5 border-2 border-arcade-panel-border bg-arcade-sky/30">
              <div
                className="h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac transition-all"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2 font-arcade text-[0.6rem] text-arcade-ink">
              {height.toFixed(1)} / {C.goalMeters} m
            </p>
            <p className="mt-1 font-arcade text-[0.55rem] text-arcade-violet">
              META: {C.goalMeters} m
            </p>
          </div>
          <div className="pixel-panel flex-1 rounded-sm p-3">
            <p className="font-arcade text-[0.55rem] text-arcade-violet">PRÓXIMA</p>
            <canvas ref={nextRef} width={110} height={60} className="mx-auto block" />
            <p className="mt-2 font-arcade text-[0.45rem] text-arcade-ink">
              PEÇAS PERDIDAS: {snap?.lostPieces ?? 0}/{maxLostPieces}
            </p>
          </div>
          <div className="pixel-panel col-span-2 hidden rounded-sm p-3 md:col-span-1 md:block">
            <p className="font-arcade text-[0.55rem] text-arcade-violet">CONTROLES</p>
            <ul className="mt-2 space-y-1 font-game text-base leading-tight text-muted-foreground">
              <li>A / D ← → mover</li>
              <li>W / ↑ girar</li>
              <li>S / ↓ acelerar</li>
              <li>ESPAÇO soltar</li>
              {characterId === "calm-capybara-mage" && (
                <li>Z: margem extra para a próxima peça (uso único)</li>
              )}
              {characterId === "axolotl-mage" && <li>Axolote: suporta até 10 peças perdidas</li>}
            </ul>
          </div>
        </aside>

        <div className="grid grid-cols-5 gap-2 md:hidden">
          <Button variant="arcadePanel" onClick={touch((e) => e.move(-1))}>
            ←
          </Button>
          <Button variant="arcadePanel" onClick={touch((e) => e.rotate())}>
            ↻
          </Button>
          <Button
            variant="arcadePanel"
            onPointerDown={touch((e) => (e.softDrop = true))}
            onPointerUp={touch((e) => (e.softDrop = false))}
            onPointerLeave={touch((e) => (e.softDrop = false))}
          >
            ↓
          </Button>
          <Button variant="arcadePanel" onClick={touch((e) => e.hardDrop())}>
            ⤓
          </Button>
          <Button variant="arcadePanel" onClick={touch((e) => e.move(1))}>
            →
          </Button>
        </div>
        {characterId === "calm-capybara-mage" && (
          <Button
            type="button"
            variant="arcadePanel"
            className="w-full md:hidden"
            onClick={activateCapybaraMargin}
            disabled={capybaraCooldown > 0 || snap?.positioningMarginState !== null}
          >
            Z · {capybaraCooldown > 0 ? `RECARGA ${capybaraCooldown.toFixed(1)}s` : snap?.positioningMarginState ? "MARGEM ATIVA" : "MARGEM NA PRÓXIMA PEÇA"}
          </Button>
        )}
      </div>
    </main>
  );
}

interface BotCardProps {
  characterId: PlayableCharacterId;
  botNumber: number;
  label: string;
  snap: TowerSnapshot | null;
  place: number;
  canvasRef: (el: HTMLCanvasElement | null) => void;
}

function BotCard({ characterId, botNumber, label, snap, place, canvasRef }: BotCardProps) {
  const ch = getCharacterById(characterId);
  const status = snap?.status ?? "playing";
  const height = snap?.heightMeters ?? 0;
  const lost = snap?.lostPieces ?? 0;
  const progress = Math.min(1, height / C.goalMeters);
  const [hurt, setHurt] = useState(false);
  useEffect(() => {
    if (lost === 0) return;
    setHurt(true);
    const t = setTimeout(() => setHurt(false), 600);
    return () => clearTimeout(t);
  }, [lost]);
  const anim = status === "won" ? "victory" : status === "lost" ? "defeat" : hurt ? "hurt" : "idle";

  return (
    <div
      className={`pixel-panel relative flex min-w-0 flex-col gap-1 rounded-sm p-1.5 ${status === "won" ? "ring-4 ring-arcade-cyan" : ""} ${status === "lost" ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-1">
        <GameplaySprite characterId={characterId} animation={anim} size={22} />
        <p className="min-w-0 flex-1 truncate font-arcade text-[0.45rem] leading-tight text-arcade-ink">
          BOT {botNumber} · {ch?.shortName}
          <br />
          <span className="text-arcade-violet">
            {height.toFixed(1)} / {C.goalMeters} m · {lost}/{C.maxLostPieces} · {label}
          </span>
        </p>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={C.width}
          height={C.height}
          className="block h-auto max-h-[64vh] w-full object-contain [image-rendering:pixelated]"
          style={{ aspectRatio: `${C.width} / ${C.height}` }}
        />
        <WinCountdown snapshot={snap} />
        {lost > 0 && status === "playing" && (
          <p
            key={`bl-${lost}`}
            className="tower-lost-pop pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap border-2 border-arcade-panel-border bg-arcade-panel px-1 font-arcade text-[0.4rem] text-arcade-violet"
          >
            PERDEU! {lost}/{C.maxLostPieces}
          </p>
        )}
        {status !== "playing" && (
          <p className="absolute inset-x-0 top-2 text-center font-arcade text-[0.5rem] text-arcade-ink">
            <span className="border-2 border-arcade-panel-border bg-arcade-panel px-1">
              {status === "won" ? `✦ ${place}º ✦` : "ELIMINADO"}
            </span>
          </p>
        )}
      </div>
      <div className="h-2 border border-arcade-panel-border bg-arcade-sky/30">
        <div
          className="h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="flex justify-between font-arcade text-[0.4rem] text-arcade-ink">
        <span>{height.toFixed(1)} m</span>
        <span className="text-arcade-violet">
          {lost}/{C.maxLostPieces}
        </span>
      </p>
    </div>
  );
}
