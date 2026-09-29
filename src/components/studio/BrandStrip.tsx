import { DogeGameLogo } from "@/components/studio/DogeGameLogo";

type BrandStripProps = {
  className?: string;
  /** bar = full-width strip, inline = compact row inside a header */
  variant?: "bar" | "inline";
};

/** DogeGameLab on DogeOS co-branding. */
export function BrandStrip({ className = "", variant = "bar" }: BrandStripProps) {
  if (variant === "inline") {
    return <DogeGameLogo coBrand className={className} />;
  }
  return (
    <div
      className={`flex items-center justify-center border-b-2 border-line bg-ink-0 px-3 py-1.5 ${className}`}
      aria-label="DogeGameLab on DogeOS"
    >
      <DogeGameLogo coBrand />
    </div>
  );
}
