import { useEffect, useState } from "react";

/**
 * Cycles through phrases with a typewriter effect — used for placeholder-style
 * hints. Falls back to the first phrase when reduced motion is requested.
 */
export function useTypewriter(phrases: readonly string[], { typeMs = 42, holdMs = 1600 } = {}) {
  const [text, setText] = useState(phrases[0] ?? "");
  useEffect(() => {
    if (!phrases.length) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setText(phrases[0]);
      return;
    }
    let phrase = 0;
    let index = 0;
    let deleting = false;
    let timer = 0;
    const tick = () => {
      const current = phrases[phrase];
      if (!deleting) {
        index += 1;
        setText(current.slice(0, index));
        if (index >= current.length) {
          deleting = true;
          timer = window.setTimeout(tick, holdMs);
          return;
        }
        timer = window.setTimeout(tick, typeMs);
        return;
      }
      index -= 2;
      setText(current.slice(0, Math.max(0, index)));
      if (index <= 0) {
        deleting = false;
        index = 0;
        phrase = (phrase + 1) % phrases.length;
      }
      timer = window.setTimeout(tick, typeMs / 2);
    };
    timer = window.setTimeout(tick, 400);
    return () => window.clearTimeout(timer);
  }, [phrases, typeMs, holdMs]);
  return text;
}
