import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { constructGameUrls } from "@/lib/studio-meta";

export function Html5Preview({
  templateId,
  onReelTouchStart,
  onReelTouchMove,
  onReelTouchEnd,
}: {
  templateId: string;
  onReelTouchStart?: (x: number, y: number, target: HTMLElement) => boolean | void;
  onReelTouchMove?: (x: number, y: number, event?: TouchEvent) => void;
  onReelTouchEnd?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const gameUrl = constructGameUrls[templateId];

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // The template's own HTML runs same-origin, but in its own document — touches
  // that start inside it never bubble to the parent reel feed. Attach listeners
  // directly on the iframe's document (legal cross-frame since same-origin) and
  // forward gesture coordinates up, so swiping over the game still changes reels.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !gameUrl) return;
    let detach: (() => void) | undefined;
    let dragging = false;

    function attach() {
      let doc: Document | null | undefined;
      try {
        doc = iframe?.contentDocument;
      } catch {
        return;
      }
      if (!doc) return;

      const onStart = (event: TouchEvent) => {
        if (event.touches.length !== 1) return;
        const touch = event.touches[0];
        dragging = Boolean(
          onReelTouchStart?.(touch.clientX, touch.clientY, event.target as HTMLElement),
        );
      };
      const onMove = (event: TouchEvent) => {
        if (!dragging || event.touches.length !== 1) return;
        const touch = event.touches[0];
        onReelTouchMove?.(touch.clientX, touch.clientY, event);
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        onReelTouchEnd?.();
      };

      doc.addEventListener("touchstart", onStart, { passive: true, capture: true });
      doc.addEventListener("touchmove", onMove, { passive: false, capture: true });
      doc.addEventListener("touchend", onEnd, { capture: true });
      doc.addEventListener("touchcancel", onEnd, { capture: true });
      detach = () => {
        doc?.removeEventListener("touchstart", onStart, true);
        doc?.removeEventListener("touchmove", onMove, true);
        doc?.removeEventListener("touchend", onEnd, true);
        doc?.removeEventListener("touchcancel", onEnd, true);
      };
    }

    iframe.addEventListener("load", attach);
    attach();
    return () => {
      iframe.removeEventListener("load", attach);
      detach?.();
    };
  }, [gameUrl, onReelTouchStart, onReelTouchMove, onReelTouchEnd]);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await wrapRef.current?.requestFullscreen?.();
      return;
    }
    await document.exitFullscreen?.();
  }

  return (
    <div className="html5-preview-wrap" ref={wrapRef}>
      {gameUrl ? (
        <iframe
          ref={iframeRef}
          title="HTML5 game preview"
          src={gameUrl}
          width="100%"
          height="100%"
          style={{ border: "none" }}
          allow="autoplay; keyboard"
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-ink-0 px-6 text-center">
          <div>
            <p className="font-pixel text-[12px] leading-relaxed text-magenta">NO CARTRIDGE</p>
            <p className="mt-3 max-w-xs text-sm text-text-2">
              This HTML game package is not installed in the app.
            </p>
          </div>
        </div>
      )}
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
