import { DogeIcon, DogeOSWordmark } from "@/components/dogeos/DogeBrand";
import { Check, Copy, ExternalLink, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PixelIcon } from "@/components/term/PixelIcon";
import { Btn, Notice } from "@/components/term/Term";
import {
  DOGEOS_CHAIN_NAME,
  DOGEOS_FAUCET_URL,
  DOGEOS_IS_TESTNET,
  dogeOSAddressUrl,
  formatDogeAmount,
} from "@/lib/dogeos";
import { useDogeWallet, type DogecoinBalance } from "@/lib/useDogeWallet";
import { cn } from "@/lib/utils";
import { formatZeroGAddress } from "@/lib/zeroGChain";

type DogeOSWalletPanelProps = {
  className?: string;
  onFunded?: () => void;
  showHeading?: boolean;
};

type Balances = {
  doge: bigint | null;
  zeroG: bigint | null;
  dogecoin: DogecoinBalance | null;
};

/** The DogeOS app icon. */
export function DogeMark({ className = "" }: { className?: string }) {
  return <DogeIcon size={40} className={cn("rounded-[11px]", className)} />;
}

function BalanceTile({
  label,
  amount,
  unit,
  hint,
  tone,
}: {
  label: string;
  amount: string | null;
  unit: string;
  hint: string;
  tone: "doge" | "amber" | "cyan";
}) {
  const color = tone === "doge" ? "text-doge" : tone === "amber" ? "text-amber" : "text-cyan";
  return (
    <div className="min-w-0 border-2 border-line bg-ink-0 px-3 py-2.5">
      <p className="label-term truncate text-text-3">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-term text-[30px] leading-none tabular-nums", color)}>
          {amount ?? "--"}
        </span>
        <span className={cn("font-mono text-[11px] font-extrabold", color)}>{unit}</span>
      </p>
      <p className="mt-1 truncate text-[10px] text-text-3">{hint}</p>
    </div>
  );
}

export function DogeOSWalletPanel({
  className = "",
  onFunded,
  showHeading = true,
}: DogeOSWalletPanelProps) {
  const {
    walletAddress,
    walletName,
    isEmbeddedWallet,
    walletLinkedOnSession,
    openWalletModal,
    readDogeOSBalance,
    readZeroGBalance,
    readDogecoinBalance,
    addZeroGFunds,
    linkWalletOnZeroGChain,
  } = useDogeWallet();
  const [balances, setBalances] = useState<Balances>({ doge: null, zeroG: null, dogecoin: null });
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  const refreshBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalance(true);
    const [doge, zeroG, dogecoin] = await Promise.all([
      readDogeOSBalance().catch(() => null),
      readZeroGBalance().catch(() => null),
      readDogecoinBalance().catch(() => null),
    ]);
    setBalances({ doge, zeroG, dogecoin });
    setLoadingBalance(false);
  }, [readDogeOSBalance, readDogecoinBalance, readZeroGBalance, walletAddress]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const copyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  const signIn = async () => {
    try {
      setSigningIn(true);
      setNotice("Confirm the sign-in signature in your DogeOS wallet…");
      await linkWalletOnZeroGChain();
      setNotice("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not sign in.";
      setNotice(/cancel|reject|denied/i.test(message) ? "" : message);
    } finally {
      setSigningIn(false);
    }
  };

  const addZeroG = async () => {
    try {
      await addZeroGFunds();
      setNotice("Address copied — send 0G on 0G mainnet to it. Balances refresh in a minute.");
      onFunded?.();
      window.setTimeout(() => void refreshBalance(), 30_000);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Could not copy your address.");
    }
  };

  if (!walletAddress) return null;

  const dogecoinTotal = balances.dogecoin ? BigInt(Math.round(balances.dogecoin.total)) : null;

  return (
    <div className={cn("text-text", className)}>
      {showHeading && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DogeMark />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-pixel text-[11px] text-text">
                <DogeOSWordmark height={10} className="text-doge" /> WALLET
              </p>
              <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-doge">
                <span className="size-1.5 shrink-0 bg-doge" />
                {walletName ?? (isEmbeddedWallet ? "Embedded wallet" : "Connected")}
                <span className="text-text-3">· {DOGEOS_CHAIN_NAME}</span>
              </p>
            </div>
          </div>
          <Btn
            variant="ghost"
            size="icon"
            onClick={() => void refreshBalance()}
            disabled={loadingBalance}
            title="Refresh balances"
            aria-label="Refresh balances"
          >
            {loadingBalance ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Btn>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BalanceTile
          label="DOGE · DogeOS"
          amount={balances.doge === null ? null : formatDogeAmount(balances.doge)}
          unit="DOGE"
          hint={DOGEOS_IS_TESTNET ? "Chikyū testnet" : "DogeOS mainnet"}
          tone="doge"
        />
        <BalanceTile
          label="0G · payments"
          amount={balances.zeroG === null ? null : formatDogeAmount(balances.zeroG)}
          unit="0G"
          hint="Pays for generations"
          tone="amber"
        />
        {dogecoinTotal !== null && (
          <div className="col-span-2">
            <BalanceTile
              label="Dogecoin · L1"
              amount={formatDogeAmount(dogecoinTotal, 8)}
              unit="DOGE"
              hint="Your Dogecoin wallet balance"
              tone="cyan"
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void copyAddress()}
          title={walletAddress}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 border-2 border-line bg-ink-1 px-3 py-2.5 text-left transition hover:border-doge"
        >
          <span className="min-w-0">
            <span className="label-term block text-text-3">Wallet address</span>
            <span className="mt-0.5 block truncate font-mono text-sm font-bold text-text">
              {formatZeroGAddress(walletAddress)}
            </span>
          </span>
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center border-2",
              copied ? "border-doge text-doge" : "border-line-2 text-text-2",
            )}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </span>
        </button>
        <a
          href={dogeOSAddressUrl(walletAddress)}
          target="_blank"
          rel="noopener noreferrer"
          title="View on DogeOS explorer"
          aria-label="View on DogeOS explorer"
          className="grid w-12 shrink-0 place-items-center border-2 border-line bg-ink-1 text-text-2 transition hover:border-doge hover:text-doge"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>

      {!walletLinkedOnSession && (
        <Btn
          variant="amber"
          className="mt-3 w-full"
          onClick={() => void signIn()}
          disabled={signingIn}
        >
          {signingIn ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PixelIcon name="wallet" size={14} />
          )}
          {signingIn ? "Waiting for signature…" : "Finish sign-in"}
        </Btn>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Btn variant="primary" onClick={() => void addZeroG()}>
          <Plus className="size-4" strokeWidth={3} />
          Add 0G
        </Btn>
        <Btn variant="ghost" onClick={openWalletModal}>
          <PixelIcon name="wallet" size={13} />
          Manage
        </Btn>
      </div>

      {DOGEOS_IS_TESTNET && (
        <a
          href={DOGEOS_FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-2 border-2 border-dashed border-doge-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-doge transition hover:border-doge"
        >
          Get test DOGE <ExternalLink className="size-3.5" />
        </a>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-text-3">
        <span className="text-doge">&gt;</span> Your DogeOS wallet is your account. Paid generations
        are settled in 0G — your wallet switches to 0G mainnet when you pay.
      </p>

      {notice && (
        <Notice kind="info" className="mt-3 text-[12px]">
          {notice}
        </Notice>
      )}
    </div>
  );
}
