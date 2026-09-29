import { Loader2 } from "lucide-react";
import { Btn, Notice, Panel, TermLoader } from "@/components/term/Term";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchCreatorSubscriptionTiers,
  fetchMyCreatorSubscription,
  purchaseCreatorSubscription,
  type CreatorSubscriptionTier,
} from "@/lib/api/creatorSubscription";
import { fetchGenerationQuota, type GenerationQuota } from "@/lib/api/generationQuota";
import { getWalletAddress } from "@/lib/identity";
import { useStudioAuth } from "@/hooks/useStudioAuth";
import { useDogeWallet } from "@/lib/useDogeWallet";
import { isWalletLinkedOnSession } from "@/lib/walletLink";
import { getWalletErrorPresentation } from "@/lib/walletErrors";
import { formatZeroGShortfall } from "@/lib/zeroGSubscriptionCheckout";

type CreatorSubscriptionPanelProps = {
  className?: string;
};

function subscriptionErrorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { error?: string; code?: string } } })?.response;
  if (response?.data?.code === "EVM_WALLET_REQUIRED") {
    return "Your DogeOS wallet is connected but not signed in yet. Approve the sign-in signature, then try again.";
  }
  return (
    response?.data?.error ??
    (error instanceof Error ? error.message : "Could not load subscription.")
  );
}

export function CreatorSubscriptionPanel({ className = "" }: CreatorSubscriptionPanelProps) {
  const { ready, authenticated, user } = useStudioAuth();
  const { ensureEvmWallet, getEthereumProvider, readZeroGBalance, linkWalletOnZeroGChain } =
    useDogeWallet();
  const [tiers, setTiers] = useState<CreatorSubscriptionTier[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<any>(null);
  const [generationQuota, setGenerationQuota] = useState<GenerationQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingTier, setPurchasingTier] = useState<1 | 2 | null>(null);
  const [notice, setNotice] = useState("");
  const [walletLinked, setWalletLinked] = useState(false);
  const loadKeyRef = useRef<string | null>(null);

  const walletAddress = getWalletAddress() ?? "";
  const loadKey = useMemo(
    () => `${authenticated ? (user?.id ?? "") : ""}:${walletAddress}`,
    [authenticated, user?.id, walletAddress],
  );

  const loadSubscriptionState = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const paymentWallet = await ensureEvmWallet();
      const linked = isWalletLinkedOnSession(paymentWallet?.address);
      setWalletLinked(linked);
      const config = await fetchCreatorSubscriptionTiers();
      setTiers(config.tiers.filter((tier) => tier.tier === 1 || tier.tier === 2));
      if (linked) {
        const subscription = await fetchMyCreatorSubscription();
        setActiveSubscription(subscription);
        const quota = await fetchGenerationQuota().catch(() => null);
        setGenerationQuota(quota);
      } else {
        setActiveSubscription(null);
        setGenerationQuota(null);
      }
    } catch (error: unknown) {
      setTiers([]);
      setActiveSubscription(null);
      setGenerationQuota(null);
      setNotice(subscriptionErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [ensureEvmWallet]);

  useEffect(() => {
    if (!ready || !authenticated) {
      loadKeyRef.current = null;
      setLoading(false);
      return;
    }
    if (loadKeyRef.current === loadKey) return;
    loadKeyRef.current = loadKey;
    void loadSubscriptionState();
  }, [authenticated, loadKey, loadSubscriptionState, ready]);

  const subscribe = async (tier: 1 | 2) => {
    try {
      setPurchasingTier(tier);
      setNotice("");
      const paymentWallet = await ensureEvmWallet();
      if (!paymentWallet?.address) {
        setNotice("Connect your DogeOS wallet, then try subscribing again.");
        return;
      }
      if (!isWalletLinkedOnSession(paymentWallet.address)) {
        setNotice("Approve the DogeOS sign-in signature. Payment confirmation comes next.");
        await linkWalletOnZeroGChain();
        setWalletLinked(true);
      }
      const plan = tiers.find((item) => item.tier === tier);
      const balance = await readZeroGBalance();
      const funding = formatZeroGShortfall(balance, plan?.price0G);
      if (!funding.sufficient) {
        setNotice(
          `You have ${funding.balanceLabel} but ${plan?.name ?? "this plan"} costs ${funding.priceLabel}.`,
        );
        return;
      }
      setNotice(`Confirm ${plan?.name ?? "subscription"} (${funding.priceLabel}) in your wallet…`);
      await purchaseCreatorSubscription(tier, 1, getEthereumProvider);
      const subscription = await fetchMyCreatorSubscription();
      setActiveSubscription(subscription);
      setWalletLinked(true);
      setNotice("Subscription active.");
      loadKeyRef.current = null;
      void loadSubscriptionState();
    } catch (error: unknown) {
      const { message } = getWalletErrorPresentation(error, { action: "subscribe with 0G" });
      setNotice(message);
    } finally {
      setPurchasingTier(null);
    }
  };

  if (!authenticated || !ready) return null;
  if (loading) {
    return (
      <Panel tone="magenta" title="creator_subscription" className={className}>
        <TermLoader label="Loading subscription" />
      </Panel>
    );
  }

  return (
    <Panel tone="magenta" title="creator_subscription" className={className}>
      {activeSubscription?.active ? (
        <div className="space-y-2">
          <div className="border-2 border-magenta-2 bg-ink-1 px-3 py-2.5">
            <p className="font-mono text-sm font-extrabold text-magenta">
              {activeSubscription.tierName ?? "Active plan"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-text-2">
              {activeSubscription.expiresAt
                ? `Renews / expires ${new Date(activeSubscription.expiresAt).toLocaleDateString()}`
                : "Active on your DogeOS wallet"}
            </p>
          </div>
          {generationQuota && (
            <ul className="space-y-1 border-2 border-line bg-ink-1 px-3 py-2.5 font-mono text-[11px] text-text-2">
              <li>
                HYBRID {generationQuota.remaining.hybridFree} free ·{" "}
                {generationQuota.remaining.hybridCredits} credits
              </li>
              <li>
                PRO {generationQuota.remaining.proFree} free ·{" "}
                {generationQuota.remaining.proCredits} credits
              </li>
              <li>
                ULTRA {generationQuota.remaining.ultraFree} free ·{" "}
                {generationQuota.remaining.ultraCredits} credits
              </li>
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {!walletLinked && (
            <Notice kind="info">
              Choose a plan below. You will first sign in once with your DogeOS wallet, then
              confirm the 0G payment (your wallet switches to 0G mainnet to pay).
            </Notice>
          )}
          <p className="font-mono text-[11px] leading-relaxed text-text-2">
            Free: 10 Hybrid · 1 Pro · 1 Ultra. Creator Plus: 15 Pro + 10 Ultra (first), then 20 Pro
            + 10 Hybrid. Creator Pro: 20 Ultra + 10 Hybrid.
          </p>
          {tiers.map((tier) => (
            <Btn
              key={tier.tier}
              variant="ghost"
              disabled={purchasingTier !== null}
              onClick={() => void subscribe(tier.tier as 1 | 2)}
              className="w-full justify-between"
            >
              <span>{tier.name}</span>
              <span className="flex items-center gap-2 text-magenta">
                {tier.price0G} 0G
                {purchasingTier === tier.tier && <Loader2 className="size-3.5 animate-spin" />}
              </span>
            </Btn>
          ))}
        </div>
      )}
      {notice && <p className="mt-2 font-mono text-[11px] text-text-2">&gt; {notice}</p>}
    </Panel>
  );
}
