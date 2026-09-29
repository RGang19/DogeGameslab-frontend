import { useEffect, useRef } from "react";
import type { ChatMessage, ChatStage } from "@/lib/createChatFlow";
import { createIdeaSeeds } from "@/lib/createChatFlow";
import { ConsoleChatMessages } from "@/components/studio/ConsoleChatMessages";
import { CreateConsolePanel } from "@/components/studio/CreateConsolePanel";
import { DogeOSBadge } from "@/components/dogeos/DogeOSBadge";
import { PixelSprite } from "@/components/term/PixelSprite";
import { DogeIcon } from "@/components/dogeos/DogeBrand";
import { PixelIcon } from "@/components/term/PixelIcon";
import { useTypewriter } from "@/components/term/TypeText";
import { cn } from "@/lib/utils";

const PIPELINE = [
  { step: "01", label: "Describe", note: "one line is enough" },
  { step: "02", label: "AI builds", note: "agents write the code" },
  { step: "03", label: "Playtest", note: "auto-tested & repaired" },
  { step: "04", label: "Publish", note: "share a playable link" },
];

const STAGES: { id: ChatStage; label: string }[] = [
  { id: "game", label: "Game" },
  { id: "vibe", label: "Vibe" },
  { id: "ready", label: "Build" },
];

type HomeHeroProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCategoryPick: (seed: string) => void;
  messages?: ChatMessage[];
  chatStage?: ChatStage;
  onQuickReply?: (text: string) => void;
  isThinking?: boolean;
};

export function HomeHero({
  value,
  onChange,
  onSubmit,
  onCategoryPick,
  messages = [],
  chatStage = "game",
  onQuickReply,
  isThinking = false,
}: HomeHeroProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const typed = useTypewriter(createIdeaSeeds);
  const stageIndex = STAGES.findIndex((stage) => stage.id === chatStage);

  // Keep the newest line in view without scrolling the page.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, isThinking]);

  return (
    <section className="px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center xl:gap-10">
        {/* Headline column */}
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-text-3">
            <span className="text-phos">$</span> ./dogegame --mode=create
          </p>
          <h1 className="font-pixel mt-4 text-[26px] leading-[1.25] text-text sm:text-[34px] xl:text-[42px]">
            <span className="block">PROMPT</span>
            <span className="block text-magenta glow-magenta">&gt; PLAYABLE</span>
          </h1>
          <p className="mt-5 max-w-md text-[14px] leading-relaxed text-text-2">
            Describe a game in plain words. DogeGame&apos;s AI agents write the code, playtest it, and
            hand you a world you can play, publish and share — on DogeOS.
          </p>
          <DogeOSBadge className="mt-4" />

          <div className="mt-6 flex items-end gap-4">
            <DogeIcon size={64} bob title="Doge" className="rounded-[18px]" />
            <div className="relative mb-6 min-w-0 flex-1 border-2 border-line-2 bg-ink-2 px-3 py-2 font-mono text-[12px] text-text-2">
              <span className="absolute -left-[9px] bottom-2 h-3 w-3 rotate-45 border-b-2 border-l-2 border-line-2 bg-ink-2" />
              <span className="text-text-3">try:</span> <span className="text-phos">{typed}</span>
              <span className="animate-blink text-phos">▌</span>
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="px-panel shadow-none" data-tone="hot">
          <header className="px-titlebar bg-phos text-ink-0">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="size-2.5 bg-ink-0" />
              <span className="size-2.5 bg-ink-0/60" />
              <span className="size-2.5 bg-ink-0/30" />
            </span>
            <span className="flex-1 truncate">new_game.sh — dogegame-bot</span>
            <span className="hidden sm:inline">tty1</span>
          </header>

          <div className="p-3 sm:p-4">
            <ol
              className="mb-3 flex items-center gap-1 font-mono text-[10px] font-extrabold uppercase tracking-[0.12em]"
              aria-label="Progress"
            >
              {STAGES.map((stage, index) => (
                <li key={stage.id} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "border-2 px-1.5 py-0.5",
                      index < stageIndex && "border-phos-3 text-phos",
                      index === stageIndex && "border-phos bg-phos text-ink-0",
                      index > stageIndex && "border-line text-text-3",
                    )}
                  >
                    {index + 1}.{stage.label}
                  </span>
                  {index < STAGES.length - 1 && <span className="text-text-3">▸</span>}
                </li>
              ))}
            </ol>

            <div
              ref={logRef}
              className="max-h-[300px] min-h-[120px] overflow-y-auto pr-1 sm:max-h-[340px]"
            >
              <ConsoleChatMessages
                messages={messages}
                chatStage={chatStage}
                isThinking={isThinking}
                onQuickReply={onQuickReply}
              />
            </div>

            <CreateConsolePanel
              className="mt-4"
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              onCategoryPick={onCategoryPick}
              disabled={isThinking}
              placeholder={value ? "" : `${typed}`}
              submitLabel={chatStage === "ready" ? "Build it" : "Send"}
            />
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <ol className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="How it works">
        {PIPELINE.map((item, index) => (
          <li
            key={item.step}
            className="relative flex items-center gap-3 border-2 border-line bg-ink-2 px-3 py-3"
          >
            <span className="font-term text-[34px] leading-none text-amber glow-amber">
              {item.step}
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[12px] font-extrabold uppercase tracking-[0.1em] text-text">
                {item.label}
              </span>
              <span className="block truncate text-[11px] text-text-3">{item.note}</span>
            </span>
            {index < PIPELINE.length - 1 && (
              <PixelIcon
                name="next"
                size={10}
                className="absolute -right-[11px] top-1/2 z-10 hidden -translate-y-1/2 text-phos sm:block"
              />
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** @deprecated name kept for imports from the previous home page. */
export const MobileHomeHero = HomeHero;
