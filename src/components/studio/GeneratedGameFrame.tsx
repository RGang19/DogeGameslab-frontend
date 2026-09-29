import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type AnyPackage = Record<string, unknown> & {
  refinement?: { generatedCode?: string; source?: string; seededFrom?: string | null };
  templateName?: string;
};

/**
 * Only absolute URLs can be fetched from the sandbox: it has an opaque origin and no
 * import map, so relative paths (`./gamePackage.js`) and bare specifiers (`three`)
 * cannot resolve.
 */
function isUnresolvableSpecifier(specifier: string): boolean {
  return !/^(?:https?:)?\/\//.test(specifier);
}

/**
 * Assembled at runtime so the literal closing tag never appears in this module — inlining
 * this bundle into an HTML page would otherwise terminate that page's script early.
 */
const CLOSE_SCRIPT = `<${"/"}script>`;

/**
 * Rewrite the agent's module so it can run standalone in the sandbox.
 *
 * Every unresolvable import is dropped — the harness supplies `gamePackage` as a global
 * instead. The binding list is matched across newlines because generated code routinely
 * spreads imports over several lines, and a surviving `import` is a parse error that
 * takes the whole game down.
 */
function prepareModule(code: string): string {
  return code
    .replace(
      /^[ \t]*import\s*(?:[\w$*,{}\s]*?\bfrom\s*)?["']([^"']+)["'][ \t]*;?/gm,
      (match, specifier: string) => (isUnresolvableSpecifier(specifier) ? "" : match),
    )
    .replace(
      /^[ \t]*export\s*(?:\*(?:\s+as\s+[\w$]+)?|\{[\w$,\s]*\})\s*from\s*["']([^"']+)["'][ \t]*;?/gm,
      (match, specifier: string) => (isUnresolvableSpecifier(specifier) ? "" : match),
    )
    .replace(/^[ \t]*export\s+default\s+/gm, "")
    .replace(/^[ \t]*export\s*\{[^}]*\}[ \t]*;?[ \t]*$/gm, "")
    .replace(/^([ \t]*)export\s+(const|let|var|function|class|async)/gm, "$1$2");
}

function buildSrcDoc(code: string, pkg: AnyPackage): string {
  // Don't ship the (large) refinement payload back into the sandbox.
  const { refinement, ...safe } = pkg;
  void refinement;
  const json = JSON.stringify(safe).replace(/</g, "\\u003c");
  // `__dogeGameParsed` proves the module compiled. A syntax error in generated code
  // never reaches any statement inside it, so the harness watchdog uses this flag to
  // tell "failed to compile" apart from "compiled and then threw".
  const moduleBody = `const gamePackage = ${json};
window.__dogeGameParsed = true;
${prepareModule(code)}`.replace(/<\/script>/gi, "<\\/script>");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; height: 100%; background: #070a12; }
  body { display: flex; align-items: center; justify-content: center; overflow: hidden; }
  /* The fit script below sizes the canvas: every game keeps ITS OWN aspect
     ratio (square boards must not be stretched to 16:9) and is scaled as large
     as the frame allows, centered by the flex body. */
  #game { display: block; touch-action: none; }
  * { box-sizing: border-box; }
</style>
</head>
<body>
<canvas id="game"></canvas>
<script>
// This harness is deliberately a separate, earlier script from the generated module
// below. Inlining them together meant a syntax error in generated code stopped the
// whole script from compiling, so these error handlers were never installed: the frame
// just went blank with an "Uncaught SyntaxError" and the host app was told nothing.
// Surface runtime errors to the host app (the editor turns them into
// one-click "fix this" requests for the agent).
let reportedGameError = false;
function reportGameError(message, stack) {
  if (reportedGameError) return;
  reportedGameError = true;
  try {
    window.parent.postMessage({ __dogeGameError: { message: String(message), stack: String(stack || "") } }, "*");
  } catch {}
}
function paintGameFailure(message) {
  const c = document.querySelector("#game");
  const ctx = c && c.getContext("2d");
  if (!ctx) return;
  // A game that failed to compile never sized its canvas, so it still has the 300x150
  // default — too narrow for the message. Give it a readable 16:9 surface instead.
  if (!window.__dogeGameParsed) { c.width = 960; c.height = 540; }
  const w = c.width, h = c.height;
  ctx.fillStyle = "#070a12"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ff6b81";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("This game failed to run", w / 2, h / 2 - 34);
  ctx.fillStyle = "#c9cddb";
  ctx.font = "15px system-ui, sans-serif";
  const words = String(message).split(" ");
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(next).width > w - 80 && line) { lines.push(line); line = words[i]; }
    else line = next;
  }
  if (line) lines.push(line);
  for (let i = 0; i < lines.length && i < 4; i++) {
    ctx.fillText(lines[i], w / 2, h / 2 + 2 + i * 21);
  }
}
// --- Storage shim -------------------------------------------------------------
// The sandbox (allow-scripts, no allow-same-origin) makes ANY access to
// window.localStorage throw a SecurityError, and generated games routinely
// persist high scores there. Shadow both storages with an in-memory Storage
// so those games run unchanged (data lives for the iframe's lifetime). Mirrors
// the shim the backend smoke test uses, so builds behave the same in both.
(function () {
  function memoryStorage() {
    const data = new Map();
    const api = {
      getItem: function (k) { return data.has(String(k)) ? data.get(String(k)) : null; },
      setItem: function (k, v) { data.set(String(k), String(v)); },
      removeItem: function (k) { data.delete(String(k)); },
      clear: function () { data.clear(); },
      key: function (i) { const keys = Array.from(data.keys()); return i in keys ? keys[i] : null; },
      get length() { return data.size; },
    };
    // Proxy so direct property use (localStorage.best = 5) shares the same data.
    return new Proxy(api, {
      get: function (t, p) {
        if (p in t) return t[p];
        return typeof p === "string" && data.has(p) ? data.get(p) : undefined;
      },
      set: function (t, p, v) { data.set(String(p), String(v)); return true; },
      deleteProperty: function (t, p) { data.delete(String(p)); return true; },
      has: function (t, p) { return p in t || data.has(String(p)); },
    });
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try {
      window[name].getItem("__dogegame_probe__");
      return; // real storage works, leave it alone
    } catch {}
    try {
      Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
    } catch {}
  });
})();
// --- Canvas fit ---------------------------------------------------------------
// Scales the canvas (up or down) to the largest size that fits the frame while
// preserving the game's own aspect ratio. The element box always equals the
// painted bitmap, so pointer math that scales by getBoundingClientRect stays
// correct. Re-fits when the game resizes its canvas or the frame changes size.
(function () {
  const c = document.querySelector("#game");
  function fit() {
    if (!c || !c.width || !c.height || !innerWidth || !innerHeight) return;
    const s = Math.min(innerWidth / c.width, innerHeight / c.height);
    c.style.width = Math.round(c.width * s) + "px";
    c.style.height = Math.round(c.height * s) + "px";
  }
  try {
    new MutationObserver(fit).observe(c, { attributes: true, attributeFilter: ["width", "height"] });
  } catch {}
  addEventListener("resize", fit);
  setInterval(fit, 1000);
  fit();
})();
// --- Leaderboard score bridge -----------------------------------------------
// Games call window.reportScore(score) when a run ends. Builds that predate
// this API are covered by a HUD watcher: it reads "Score: N" style text the
// game draws each frame and submits the best value when game-over text shows.
(function () {
  let best = 0;
  let explicit = false;
  let lastSentAt = 0;
  function send(score) {
    const value = Math.max(0, Math.floor(Number(score) || 0));
    try { window.parent.postMessage({ __dogeGameScore: value }, "*"); } catch {}
  }
  window.reportScore = function (score) {
    explicit = true;
    send(score);
  };
  const scoreRe = /(?:score|pts|points)\\s*[:\\-]?\\s*([0-9][0-9,]*)/i;
  const overRe = /game\\s*over|you\\s*win|you\\s*lose|you\\s*died|crashed|squashed|board\\s*cleared|out\\s*of\\s*moves|quiz\\s*complete|wins|you\\s*fell|press\\s*r|tap\\s*to\\s*restart|play\\s*again/i;
  function scan(text) {
    const s = String(text);
    // Game-over detection feeds the touch bridge (tap = restart when over).
    // Runs even with explicit scoring so restart-by-tap always works.
    if (overRe.test(s)) {
      window.__dogeGameOver = true;
    }
    if (explicit) return;
    const m = s.match(scoreRe);
    if (m) {
      const v = parseInt(m[1].replace(/,/g, ""), 10);
      if (Number.isFinite(v)) best = Math.max(best, v);
    }
    if (overRe.test(s) && Date.now() - lastSentAt > 5000) {
      lastSentAt = Date.now();
      send(best);
    }
  }
  const origFill = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
    scan(text);
    return maxWidth === undefined ? origFill.call(this, text, x, y) : origFill.call(this, text, x, y, maxWidth);
  };
  const origStroke = CanvasRenderingContext2D.prototype.strokeText;
  CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, maxWidth) {
    scan(text);
    return maxWidth === undefined ? origStroke.call(this, text, x, y) : origStroke.call(this, text, x, y, maxWidth);
  };
})();
// --- Touch input bridge -----------------------------------------------------
// Keyboard-only generated games (arrow keys to move, R/Space to restart) are
// unplayable on phones — there is no keyboard. Translate touch gestures into
// the keyboard events the game already listens for, so every game works on
// mobile without changing its code: swipe -> arrow keys, tap -> action
// (Space), and a tap while "GAME OVER" is showing -> restart (R/Enter/Space).
(function () {
  const canvas = document.querySelector("#game");
  function makeKey(type, k, code, keyCode) {
    const ev = new KeyboardEvent(type, { key: k, code: code, bubbles: true, cancelable: true });
    // keyCode/which are legacy getters the init dict can't set; force them so
    // games that check e.keyCode === 38 also respond.
    try { Object.defineProperty(ev, "keyCode", { get: function () { return keyCode; } }); } catch (e) {}
    try { Object.defineProperty(ev, "which", { get: function () { return keyCode; } }); } catch (e) {}
    return ev;
  }
  function press(k, code, keyCode) {
    [window, document, canvas].forEach(function (t) {
      if (!t) return;
      t.dispatchEvent(makeKey("keydown", k, code, keyCode));
    });
    setTimeout(function () {
      [window, document, canvas].forEach(function (t) {
        if (!t) return;
        t.dispatchEvent(makeKey("keyup", k, code, keyCode));
      });
    }, 90);
  }
  const K = {
    up: ["ArrowUp", "ArrowUp", 38],
    down: ["ArrowDown", "ArrowDown", 40],
    left: ["ArrowLeft", "ArrowLeft", 37],
    right: ["ArrowRight", "ArrowRight", 39],
    space: [" ", "Space", 32],
    enter: ["Enter", "Enter", 13],
    r: ["r", "KeyR", 82],
  };
  function tap(name) { press(K[name][0], K[name][1], K[name][2]); }
  function restart() {
    tap("r");
    tap("enter");
    tap("space");
    window.__dogeGameOver = false;
  }

  // The parent reel feed runs its own classifier on the same touch (vertical
  // drag = change game, everything else = leave it to the game). Without this
  // flag, a swipe the parent claims as "change reel" would ALSO replay here as
  // an arrow-key press the instant the finger lifts — the reel slides AND the
  // game moves off the same gesture. The parent posts this the moment its
  // classifier commits to "reel" so this bridge can bail before dispatching.
  let suppressKeys = false;
  window.addEventListener("message", function (e) {
    if (e.data && e.data.__dogeGameSuppressGestureKeys) suppressKeys = true;
  });

  let sx = 0, sy = 0;
  function begin(x, y) { sx = x; sy = y; suppressKeys = false; }
  function finish(x, y) {
    if (suppressKeys) { suppressKeys = false; return; }
    const dx = x - sx, dy = y - sy;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx < 24 && ady < 24) {
      // A tap: restart when the run is over, otherwise a generic action.
      if (window.__dogeGameOver) restart(); else tap("space");
      return;
    }
    if (adx > ady) tap(dx > 0 ? "right" : "left");
    else tap(dy > 0 ? "down" : "up");
  }
  // Also forward raw gesture coordinates to the parent reel feed: a cross-origin
  // sandboxed iframe (allow-scripts, no allow-same-origin) can't let touches
  // bubble out on their own, so without this a vertical swipe here would only
  // ever move this one game and could never change reels.
  function sendGesture(phase, x, y) {
    try { window.parent.postMessage({ __dogeGameReelGesture: { phase: phase, x: x, y: y } }, "*"); } catch {}
  }
  // Listen on window in CAPTURE phase so the reel bridge sees every touch
  // first — before the game's own handlers can stopPropagation() it or before
  // it lands on a canvas the game later replaces. Capture is passive (we never
  // block the game); the parent decides vertical=reel vs. other=game.
  const opts = { passive: true, capture: true };
  window.addEventListener("touchstart", function (e) {
    const t = e.touches[0];
    if (t) { begin(t.clientX, t.clientY); sendGesture("start", t.clientX, t.clientY); }
  }, opts);
  window.addEventListener("touchmove", function (e) {
    const t = e.touches[0];
    if (t) sendGesture("move", t.clientX, t.clientY);
  }, opts);
  window.addEventListener("touchend", function (e) {
    const t = e.changedTouches[0];
    if (t) finish(t.clientX, t.clientY);
    sendGesture("end", 0, 0);
  }, opts);
  window.addEventListener("touchcancel", function () {
    sendGesture("end", 0, 0);
  }, opts);
  // Mouse: only used to restart by clicking once the run is over. During play
  // the keyboard works on desktop, and real clicks still reach pointer games.
  window.addEventListener("mouseup", function () {
    if (window.__dogeGameOver) restart();
  });
})();
// Compile errors in the module below are reported here rather than thrown into a
// try/catch, which cannot see them.
window.addEventListener("error", (event) => {
  const message = event.message || (event.error && event.error.message) || "Unknown error";
  paintGameFailure(message);
  reportGameError(message, event.error && event.error.stack);
});
window.addEventListener("unhandledrejection", (event) => {
  reportGameError(event.reason && event.reason.message || event.reason, event.reason && event.reason.stack);
});
// Some engines report a module compile failure to the console without firing an error
// event, which would otherwise leave the reel sitting on a blank canvas forever.
setTimeout(function () {
  if (window.__dogeGameParsed) return;
  const message = "the generated code has a syntax error and could not start";
  paintGameFailure(message);
  reportGameError(message, "");
}, 4000);
${CLOSE_SCRIPT}
<script type="module">
${moduleBody}
${CLOSE_SCRIPT}
</body>
</html>`;
}

export function GeneratedGameFrame({
  gamePackage,
  onScoreSubmit,
  onReelTouchStart,
  onReelTouchMove,
  onReelTouchEnd,
}: {
  gamePackage: AnyPackage;
  onScoreSubmit?: (score: number) => void;
  onReelTouchStart?: (x: number, y: number, target: HTMLElement) => boolean | void;
  onReelTouchMove?: (
    x: number,
    y: number,
    event?: TouchEvent,
  ) => "reel" | "game" | "undecided" | void;
  onReelTouchEnd?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reelDraggingRef = useRef(false);
  const reelSuppressSentRef = useRef(false);

  // Scores posted by the sandboxed game (reportScore API or HUD watcher), and
  // reel-swipe gestures forwarded from the harness's touch bridge (see
  // buildSrcDoc's "Touch input bridge" — the sandbox has no allow-same-origin,
  // so postMessage is the only way gestures inside it can reach the parent).
  useEffect(() => {
    if (!onScoreSubmit && !onReelTouchStart && !onReelTouchMove && !onReelTouchEnd) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const score = event.data?.__dogeGameScore;
      if (typeof score === "number" && Number.isFinite(score) && score >= 0) {
        onScoreSubmit?.(Math.floor(score));
      }
      const gesture = event.data?.__dogeGameReelGesture;
      if (gesture && typeof gesture === "object") {
        if (gesture.phase === "start") {
          reelSuppressSentRef.current = false;
          reelDraggingRef.current = Boolean(
            onReelTouchStart?.(gesture.x, gesture.y, iframeRef.current as unknown as HTMLElement),
          );
        } else if (gesture.phase === "move") {
          if (reelDraggingRef.current) {
            const mode = onReelTouchMove?.(gesture.x, gesture.y);
            // The parent just committed this drag to "change reel" — tell the
            // sandboxed game's own touch bridge to skip the arrow-key it would
            // otherwise fire on touchend, so the swipe doesn't also move the game.
            if (mode === "reel" && !reelSuppressSentRef.current) {
              reelSuppressSentRef.current = true;
              iframeRef.current?.contentWindow?.postMessage(
                { __dogeGameSuppressGestureKeys: true },
                "*",
              );
            }
          }
        } else if (gesture.phase === "end") {
          if (reelDraggingRef.current) onReelTouchEnd?.();
          reelDraggingRef.current = false;
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onScoreSubmit, onReelTouchStart, onReelTouchMove, onReelTouchEnd]);

  const code = gamePackage?.refinement?.generatedCode ?? "";
  const srcDoc = useMemo(() => buildSrcDoc(code, gamePackage), [code, gamePackage]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await wrapRef.current?.requestFullscreen?.();
      return;
    }
    await document.exitFullscreen?.();
  }

  return (
    <div className="three-preview-wrap" ref={wrapRef}>
      <iframe
        ref={iframeRef}
        title={`${gamePackage?.templateName ?? "Generated"} game`}
        className="three-preview"
        // Isolated origin: the agent's code cannot touch the parent app.
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        style={{ width: "100%", height: "100%", border: "none", display: "block" }}
        allow="autoplay; fullscreen; gamepad"
      />
      <button
        type="button"
        className="fullscreen-button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        title={isFullscreen ? "Exit full screen" : "Enter full screen"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  );
}
