import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { WalletAccountPopover } from "@/components/studio/WalletAccountPopover";
import { PixelIcon } from "@/components/term/PixelIcon";
import { PixelSprite } from "@/components/term/PixelSprite";
import { DogeIcon } from "@/components/dogeos/DogeBrand";
import { Block, Btn } from "@/components/term/Term";
import { useStudioAuth } from "@/hooks/useStudioAuth";
import { cn } from "@/lib/utils";

type StudioSignInButtonProps = {
  /** header = status bar, sidebar = command rail, profile = full-width gate */
  variant?: "header" | "sidebar" | "profile";
  compact?: boolean;
  responsive?: boolean;
  className?: string;
};

export function StudioSignInButton({
  variant = "header",
  compact = false,
  responsive = false,
  className = "",
}: StudioSignInButtonProps) {
  const { configured, ready, authenticated, authLoading, signInLabel, signInHint, openLogin, signOut } =
    useStudioAuth();

  if (!configured) return null;

  if (!ready) {
    if (variant === "profile") return <Block className="mt-5 h-11 w-full" />;
    return (
      <Block className={cn(variant === "header" ? "h-9 w-9 sm:w-24" : "h-10 w-full", className)} />
    );
  }

  if (authenticated) {
    if (variant !== "header") return null;
    return (
      <WalletAccountPopover onSignOut={signOut}>
        <Btn
          variant="ghost"
          size={responsive ? "icon" : "sm"}
          title="DogeOS wallet"
          aria-label="Open DogeOS wallet"
          className={cn("text-doge", className)}
        >
          <PixelIcon name="wallet" size={15} />
        </Btn>
      </WalletAccountPopover>
    );
  }

  const loading = authLoading;
  const onClick = () => void openLogin();

  if (variant === "profile") {
    return (
      <Btn
        variant="primary"
        size="lg"
        onClick={onClick}
        disabled={loading}
        title={signInHint}
        className={cn("mt-5 w-full", className)}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <PixelIcon name="play" size={13} />
        )}
        {loading ? "Connecting…" : signInLabel}
      </Btn>
    );
  }

  if (variant === "sidebar") {
    return (
      <Btn
        variant="primary"
        onClick={onClick}
        disabled={loading}
        title={signInHint}
        aria-label={signInLabel}
        size={compact ? "icon" : "md"}
        className={cn(compact ? "mx-auto" : "w-full", className)}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <PixelIcon name="wallet" size={14} />
        )}
        {!compact && (loading ? "Connecting…" : signInLabel)}
      </Btn>
    );
  }

  return (
    <Btn
      variant="primary"
      size="sm"
      onClick={onClick}
      disabled={loading}
      title={signInHint}
      aria-label={signInLabel}
      className={cn(responsive ? "px-2.5 sm:px-3" : "", className)}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <PixelIcon name="wallet" size={13} />
      )}
      {!compact && <span>{signInLabel}</span>}
      {compact && responsive && <span className="hidden sm:inline">{signInLabel}</span>}
    </Btn>
  );
}

/** Sign-in gate card — same login flow as the status-bar button. */
export function StudioSignInGate({
  title,
  description,
  footer,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
}) {
  const { signInHint } = useStudioAuth();

  return (
    <section className="px-panel w-full max-w-sm" data-tone="phos">
      <header className="px-titlebar">
        <span className="flex-1">access_control</span>
        <span className="text-amber">locked</span>
      </header>
      <div className="flex flex-col items-center p-6 text-center">
        <DogeIcon size={72} bob className="rounded-[20px]" />
        <h1 className="font-pixel mt-5 text-[13px] leading-relaxed text-text">{title}</h1>
        <p className="mt-3 text-sm text-text-2">{description}</p>
        <p className="mt-3 text-[11px] leading-relaxed text-text-3">{signInHint}</p>
        <StudioSignInButton variant="profile" />
        {footer}
      </div>
    </section>
  );
}
