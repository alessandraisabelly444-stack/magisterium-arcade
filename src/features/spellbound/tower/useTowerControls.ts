import { useEffect } from "react";

import type { TowerEngine } from "./engine";

/** Keyboard controls: A/D ←/→ move, W/↑ rotate, S/↓ soft drop, Space hard drop. */
export function useTowerControls(getEngine: () => TowerEngine | null) {
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const engine = getEngine();
      if (!engine) return;
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
      if (k === "a" || k === "arrowleft") engine.move(-1);
      else if (k === "d" || k === "arrowright") engine.move(1);
      else if ((k === "w" || k === "arrowup") && !e.repeat) engine.rotate();
      else if (k === "s" || k === "arrowdown") engine.softDrop = true;
      else if (k === " " && !e.repeat) engine.hardDrop();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const engine = getEngine();
      if (engine && (k === "s" || k === "arrowdown")) engine.softDrop = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [getEngine]);
}
