import { useEffect, useId, useRef, type ComponentType, type KeyboardEvent } from "react";
import { Sparkles, Swords, Trophy, Volleyball } from "lucide-react";
import { PixelIcon } from "@/components/term/PixelIcon";
import { Btn } from "@/components/term/Term";
import { cn } from "@/lib/utils";

export type CreateCategory = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  seed: string;
};

export const defaultCreateCategories: CreateCategory[] = [
  { label: "Sports", icon: Volleyball, seed: "Sports game with exciting levels and quick matches" },
  { label: "Racing", icon: Trophy, seed: "Fast arcade racing game with drift boosts" },
  { label: "RPG", icon: Swords, seed: "Fantasy RPG adventure with quests and loot" },
  { label: "More", icon: Sparkles, seed: "Creative arcade game with unique mechanics" },
];

type CreateConsolePanelProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCategoryPick?: (seed: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Label on the submit key. */
  submitLabel?: string;
  /** Hide the F-key category row. */
  hideCategories?: boolean;
  autoFocus?: boolean;
  className?: string;
  // Accepted for call-site compatibility with the previous console hero.
  onExpandedChange?: (expanded: boolean) => void;
  delegateExpand?: boolean;
  embedded?: boolean;
  fillScreen?: boolean;
  startExpanded?: boolean;
  lockCompact?: boolean;
  persistExpanded?: boolean;
  modalTheme?: boolean;
};

/**
 * Prompt line: `$ ` plus an auto-growing textarea. Enter submits,
 * Shift+Enter adds a line. Categories sit underneath as function keys.
 */
export function CreateConsolePanel({
  value,
  onChange,
  onSubmit,
  onCategoryPick,
  placeholder = "Describe your game idea...",
  disabled = false,
  submitLabel = "Generate",
  hideCategories = false,
  autoFocus = false,
  className = "",
}: CreateConsolePanelProps) {
  const inputId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text up to ~8 lines, then scroll.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) fieldRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const handleSubmit = () => {
    if (!value.trim() || disabled) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const pickCategory = (seed: string) => {
    if (!value.trim()) onChange(seed);
    onCategoryPick?.(seed);
    requestAnimationFrame(() => fieldRef.current?.focus({ preventScroll: true }));
  };

  return (
    <section className={cn("font-mono", className)}>
      <label
        htmlFor={inputId}
        className={cn(
          "flex cursor-text items-start gap-2 border-2 bg-ink-0 px-3 py-2.5 transition-colors",
          value.trim() ? "border-phos" : "animate-pulse-frame border-phos-3",
          disabled && "opacity-60",
        )}
      >
        <span className="select-none pt-px text-[14px] font-extrabold text-phos">$</span>
        <textarea
          id={inputId}
          ref={fieldRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Describe your game"
          className="min-h-[24px] w-full resize-none bg-transparent text-[14px] leading-6 text-text caret-phos outline-none placeholder:text-text-3"
        />
      </label>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {!hideCategories && (
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {defaultCreateCategories.map((item, index) => (
              <button
                key={item.label}
                type="button"
                disabled={disabled}
                onClick={() => pickCategory(item.seed)}
                className="flex h-8 items-center gap-1.5 border-2 border-line bg-ink-1 px-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-2 transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
              >
                <span className="text-amber">F{index + 1}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
        <Btn
          variant="primary"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={hideCategories ? "ml-auto" : ""}
          aria-label={submitLabel}
        >
          <PixelIcon name="play" size={11} />
          {submitLabel}
          <span className="hidden text-[10px] opacity-70 sm:inline">⏎</span>
        </Btn>
      </div>
    </section>
  );
}
