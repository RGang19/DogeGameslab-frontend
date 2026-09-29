import type { ChatMessage, ChatStage } from "@/lib/createChatFlow";
import { quickRepliesForStage } from "@/lib/createChatFlow";
import { Spinner } from "@/components/term/Term";
import { cn } from "@/lib/utils";

type ConsoleChatMessagesProps = {
  messages: ChatMessage[];
  chatStage: ChatStage;
  isThinking?: boolean;
  onQuickReply?: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * The conversation rendered as a terminal session log. It never owns a
 * scrollbar — the parent's scroll container does.
 */
export function ConsoleChatMessages({
  messages,
  chatStage,
  isThinking = false,
  onQuickReply,
  disabled = false,
  className = "",
}: ConsoleChatMessagesProps) {
  const quickReplies = quickRepliesForStage(chatStage);

  return (
    <section
      className={cn("flex flex-col font-mono text-[13px] leading-relaxed", className)}
      aria-live="polite"
    >
      <ol className="space-y-2.5">
        {messages.map((message, index) =>
          message.role === "assistant" ? (
            <li key={`a-${index}`} className="animate-rise flex gap-2">
              <span className="shrink-0 font-bold text-phos">dogegame-bot ▸</span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-text">
                {message.text}
              </span>
            </li>
          ) : (
            <li key={`u-${index}`} className="animate-rise flex gap-2">
              <span className="shrink-0 font-bold text-cyan">you $</span>
              <span className="min-w-0 whitespace-pre-wrap break-words text-text-2">
                {message.text}
              </span>
            </li>
          ),
        )}
        {isThinking && (
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-phos">dogegame-bot ▸</span>
            <span className="text-amber">
              <Spinner /> thinking…
            </span>
          </li>
        )}
      </ol>

      {quickReplies.length > 0 && onQuickReply && (
        <div className="mt-3 border-t-2 border-dashed border-line pt-3">
          <p className="label-term mb-2 text-text-3">
            {chatStage === "game"
              ? "pick an idea or type your own"
              : "pick a vibe or type your own"}
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {quickReplies.map((idea) => (
              <button
                key={idea}
                type="button"
                disabled={disabled || isThinking}
                onClick={() => onQuickReply(idea)}
                className="group flex min-h-10 items-center gap-2 border-2 border-line bg-ink-1 px-3 py-2 text-left text-[12px] text-text-2 transition-colors hover:border-phos hover:bg-phos/5 hover:text-phos disabled:opacity-50"
              >
                <span className="text-text-3 group-hover:text-phos">›</span>
                <span className="min-w-0">{idea}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
