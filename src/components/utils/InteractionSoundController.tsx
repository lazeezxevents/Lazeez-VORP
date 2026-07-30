import { useEffect } from "react";
import { playSound } from "./soundEffects";

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "[role=button]",
  "[role=menuitem]",
  "[role=option]",
  "input",
  "select",
  "textarea",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Enables the Hover sounds preference consistently across the application. */
export function InteractionSoundController() {
  useEffect(() => {
    let lastTarget: Element | null = null;
    let lastPlayedAt = 0;

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest(INTERACTIVE_SELECTOR)
        : null;
      if (!target || target === lastTarget) return;

      const now = Date.now();
      lastTarget = target;
      if (now - lastPlayedAt < 120) return;
      lastPlayedAt = now;
      playSound("hover");
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    return () => document.removeEventListener("pointerover", onPointerOver);
  }, []);

  return null;
}
