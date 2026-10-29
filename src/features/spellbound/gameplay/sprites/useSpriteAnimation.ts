import { useEffect, useState } from "react";

import type { SpriteAnimation } from "./types";

/** Advances the frame index of an animation. Non-looping animations stop on the last frame. */
export function useSpriteAnimation(animation: SpriteAnimation | undefined) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
    if (!animation) return;
    const interval = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next < animation.frames.length) return next;
        return animation.loop ? 0 : current;
      });
    }, 1000 / animation.fps);
    return () => window.clearInterval(interval);
  }, [animation]);

  return animation?.frames[frameIndex] ?? animation?.frames[0];
}
