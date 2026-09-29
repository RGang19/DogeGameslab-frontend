import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PixelIcon, type PixelIconName } from "@/components/term/PixelIcon";
import { PixelSprite } from "@/components/term/PixelSprite";
import { DogeIcon } from "@/components/dogeos/DogeBrand";
import { DogeOSBadge } from "@/components/dogeos/DogeOSBadge";
import {
  Btn,
  Meter,
  Notice,
  Panel,
  Spinner,
  TONE_TEXT,
  TONE_VAR,
  Tag,
  type Tone,
} from "@/components/term/Term";
import { cn } from "@/lib/utils";

// Three quality tiers. The tier the user taps owns the models AND the strategy
// on the backend (Tier 1 = hybrid seed-edit, Tier 2 & 3 = fully agentic from
// scratch), so the button only needs to send the tier number.
const tierButtons: {
  tier: 1 | 2 | 3;
  label: string;
  subtitle: string;
  icon: PixelIconName;
  tone: Tone;
  speed: string;
  perks: string[];
}[] = [
  {
    tier: 1,
    label: "HYBRID",
    subtitle: "Fast build from a proven template. Best value.",
    icon: "bolt",
    tone: "phos",
    speed: "FAST",
    perks: ["Proven template base", "Ready in ~2 min"],
  },
  {
    tier: 2,
    label: "PRO",
    subtitle: "Fully AI-built from scratch. Stronger results.",
    icon: "code",
    tone: "cyan",
    speed: "SMART",
    perks: ["Written from scratch", "Auto-playtested"],
  },
  {
    tier: 3,
    label: "ULTRA",
    subtitle: "Best models, best game. Premium.",
    icon: "crown",
    tone: "amber",
    speed: "BEST",
    perks: ["Top AI models", "Richest gameplay"],
  },
];
import { useStudioContext } from "@/context/StudioContext";
import { api, clearAuthToken, prefetchAuthToken } from "@/lib/api";
import { findGameTemplate } from "@/lib/templates-loader";
import { engineOf } from "@/lib/studio-meta";
import { useStudioAuth } from "@/hooks/useStudioAuth";
import { getWalletAddress } from "@/lib/identity";
import { useDogeWallet } from "@/lib/useDogeWallet";
import { formatZeroGShortfall, hasSufficientZeroGBalance } from "@/lib/zeroGSubscriptionCheckout";
import { isWalletLinkedOnSession } from "@/lib/walletLink";
import { getWalletErrorPresentation, isWalletUserAbort } from "@/lib/walletErrors";
import { parseHumanZeroGAmount } from "@/lib/zeroGChain";
import { CreatePageSkeleton } from "@/components/studio/PageSkeletons";
import { ConsoleChatMessages } from "@/components/studio/ConsoleChatMessages";
import { CreateConsolePanel } from "@/components/studio/CreateConsolePanel";
import { DogeOSWalletPanel } from "@/components/dogeos/DogeOSWalletPanel";
import { useCreateChatFlow } from "@/hooks/useCreateChatFlow";
import {
  fetchCreatorSubscriptionTiers,
  purchaseCreatorSubscription,
} from "@/lib/api/creatorSubscription";
import {
  fetchGenerationQuota,
  tierQuotaHint,
  type GenerationQuota,
} from "@/lib/api/generationQuota";
import { publishGamePackage } from "@/lib/api/publishGame";

export const Route = createFileRoute("/_app/create")({
  pendingComponent: CreatePageSkeleton,
  head: () => ({
    meta: [
      { title: "Create — Creator Studio" },
      {
        name: "description",
        content: "Describe your game in a prompt and let the agent build a playable version.",
      },
    ],
  }),
  component: Create,
});

type PaymentChoiceBase = {
  tier: 1 | 2 | 3;
  buildPrompt: string;
  subscriptionTier?: 1 | 2;
  subscriptionName?: string;
  subscriptionPrice0G?: string;
  walletRequired?: boolean;
  chainMethod: "0g";
  chainAmount: number;
  chainCurrency: string;
};
type PaymentChoice =
  | (PaymentChoiceBase & { billingMode: "subscription" })
  | (PaymentChoiceBase & { billingMode: "legacy" });

const steps = [
  "Submitting prompt",
  "Writing game code",
  "Testing & repairing",
  "Playable build ready",
];
const CREATE_STEPS = [
  { label: "Describe", note: "your idea" },
  { label: "Spec", note: "review & edit" },
  { label: "Build", note: "play & publish" },
];

const PENDING_CHAIN_GENERATION_PAYMENT_KEY = "dogegame-pending-chain-generation-payment";

const stageToStep: Record<string, number> = {
  "writing-code": 1,
  "editing-seed": 1,
  repairing: 2,
  "fixing-syntax": 2,
  "fixing-runtime": 2,
};

function Create() {
  const { studio, addCreatedGame, removeCreatedGame } = useStudioContext();
  const { ready: authReady, authenticated, user, openLogin, syncWalletIdentity } = useStudioAuth();
  const {
    ensureEvmWallet,
    getEthereumProvider,
    sendZeroGGenerationPayment,
    addZeroGFunds,
    readZeroGBalance,
    linkWalletOnZeroGChain,
  } = useDogeWallet();
  const navigate = useNavigate();
  const [templateSeed, setTemplateSeed] = useState<any | null>(null);
  const chat = useCreateChatFlow({
    onPromptChange: (prompt) => studio.setPrompt(prompt),
  });
  const {
    messages,
    setMessages,
    chatStage,
    setChatStage,
    chatInput,
    setChatInput,
    gameRequest,
    setGameRequest,
    finalPrompt,
    setFinalPrompt,
    sendChat,
    submitComposerPrompt: submitChatPrompt,
    chatPrompt,
    isThinking,
    resetChat,
  } = chat;
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [generationNotice, setGenerationNotice] = useState("");
  const [generationNoticeKind, setGenerationNoticeKind] = useState<"info" | "payment" | "error">(
    "info",
  );
  const [isPaying, setIsPaying] = useState(false);
  const [isFundingWallet, setIsFundingWallet] = useState(false);
  const [publishingGame, setPublishingGame] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [enhancedPromptDraft, setEnhancedPromptDraft] = useState("");
  // When a 2nd+ game needs payment, we hold the pending build here and let the
  // user confirm the 0G payment instead of auto-charging.
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice | null>(null);
  const [subscriptionFunded, setSubscriptionFunded] = useState<boolean | null>(null);
  const [generationQuota, setGenerationQuota] = useState<GenerationQuota | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const subscriptionCheckoutKeyRef = useRef<string | null>(null);

  // The build itself lives in studio state + localStorage (dogegame-active-build),
  // so it survives navigating away and full page refreshes. This page only
  // renders whatever build is active until the user cancels/dismisses it.
  const activeBuild = studio.activeBuild;
  const phase: "idle" | "building" | "done" | "failed" = activeBuild ? activeBuild.phase : "idle";
  const buildingTier = phase === "building" ? activeBuild!.tier : null;
  const builtGame = activeBuild?.game ?? null;
  const builtGameId = builtGame?.id ?? studio.generatedPackage?.id ?? null;
  const canPickBuildTier = chatStage === "ready" && phase !== "building";
  const stepIndex = phase !== "idle" ? 2 : chatStage === "ready" ? 1 : 0;
  // Re-render once a second while building so the elapsed time and step list move
  // even between 5s job polls.
  const [, setTick] = useState(0);
  useEffect(() => {
    const templateId = sessionStorage.getItem("dogegame-create-template-id");
    if (templateId) {
      sessionStorage.removeItem("dogegame-create-template-id");
      void findGameTemplate(templateId).then((template) => {
        if (!template) return;
        setTemplateSeed(template);
        studio.setEngine(engineOf(template));
        studio.setSelectedId(template.id);
        const category = String(template.category ?? "arcade").toLowerCase();
        const basePrompt = `Create a game like ${template.name}. Keep the core ${category} template feel: ${template.mechanic}`;
        setGameRequest(basePrompt);
        setChatStage("vibe");
        setMessages([
          {
            role: "assistant",
            text: `${template.name} is selected as your template. Tell me what theme, characters, rules, or difficulty changes you want.`,
          },
          { role: "user", text: basePrompt },
        ]);
        studio.setPrompt(basePrompt);
      });
      return;
    }

    const remixPrompt = sessionStorage.getItem("dogegame-remix-prompt");
    if (remixPrompt) {
      sessionStorage.removeItem("dogegame-remix-prompt");
      setGameRequest(remixPrompt);
      setChatStage("vibe");
      setMessages([
        { role: "assistant", text: "Remix loaded. What theme or character swap do you want?" },
        { role: "user", text: remixPrompt },
      ]);
      studio.setPrompt(remixPrompt);
      return;
    }

    const heroPrompt = sessionStorage.getItem("dogegame-create-prompt");
    if (heroPrompt) {
      sessionStorage.removeItem("dogegame-create-prompt");
      studio.setPrompt(heroPrompt);
      setGameRequest(heroPrompt);
      setFinalPrompt(heroPrompt);
      setChatStage("ready");
      setMessages([
        { role: "assistant", text: "Hey there! What kind of game do you want to create?" },
        { role: "user", text: heroPrompt.split(".")[0] ?? heroPrompt },
        { role: "assistant", text: heroPrompt },
        {
          role: "assistant",
          text: "Plan ready! Choose Hybrid Mode or Pure Agent Strategy below to start building.",
        },
      ]);
    }
  }, [studio, setChatStage, setFinalPrompt, setGameRequest, setMessages]);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (phase !== "building") return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const elapsedSec = activeBuild
    ? Math.max(0, Math.floor((Date.now() - activeBuild.startedAt) / 1000))
    : 0;
  const step =
    phase === "building" ? (stageToStep[activeBuild?.progressStage ?? ""] ?? 0) : steps.length - 1;

  const showNotice = (message: string, kind: "info" | "payment" | "error" = "info") => {
    setGenerationNotice(message);
    setGenerationNoticeKind(kind);
    requestAnimationFrame(() => {
      noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const requireLogin = () => {
    if (!authReady) return false;
    if (authenticated && user) return true;
    showNotice("Sign in to generate and save your game.");
    void openLogin();
    return false;
  };

  useEffect(() => {
    if (phase !== "failed") return;
    const statusText = activeBuild?.statusText ?? studio.agentStatus ?? "";
    if (!statusText) return;
    if (/free game|0G|payment required|subscription|required|generate another/i.test(statusText)) {
      setGenerationNotice(statusText);
      setGenerationNoticeKind("payment");
    } else if (!generationNotice) {
      setGenerationNotice(statusText);
      setGenerationNoticeKind("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, activeBuild?.statusText]);

  useEffect(() => {
    if (!authReady || !authenticated) return;
    void fetchGenerationQuota()
      .then(setGenerationQuota)
      .catch(() => setGenerationQuota(null));
  }, [authReady, authenticated, phase, activeBuild?.game?.id]);

  useEffect(() => {
    if (!paymentChoice || paymentChoice.billingMode !== "subscription") {
      setSubscriptionFunded(null);
      return;
    }
    let cancelled = false;
    void readZeroGBalance()
      .then((balance) => {
        if (cancelled) return;
        setSubscriptionFunded(
          hasSufficientZeroGBalance(balance, paymentChoice.subscriptionPrice0G),
        );
      })
      .catch(() => {
        if (!cancelled) setSubscriptionFunded(null);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentChoice, readZeroGBalance]);

  const formatPaidGenerationNotice = (error: any) => {
    const data = error?.response?.data;
    const payment = data?.payment;
    const amount = payment?.amount ?? 1;
    const currency = payment?.currency ?? "0G";
    const existing = Number(payment?.existingGames ?? 0);
    const serverError = String(data?.error ?? "").trim();
    if (data?.code === "SUBSCRIPTION_REQUIRED" || data?.code === "GENERATION_QUOTA_EXCEEDED") {
      return (
        serverError || `${data?.subscription?.requiredTierName ?? "A subscription"} is required.`
      );
    }
    if (data?.code === "PAID_GENERATION_REQUIRED") {
      return (
        serverError ||
        `You've already created your free game${existing > 0 ? ` (${existing} so far)` : ""}. Pay ${amount} ${currency} to generate another.`
      );
    }
    return serverError || error?.message || "Could not start generation.";
  };

  type SubscriptionPaymentChoice = Extract<
    NonNullable<typeof paymentChoice>,
    { billingMode: "subscription" }
  >;

  const showWalletNotice = (error: unknown, action = "subscribe with 0G") => {
    const { message, kind } = getWalletErrorPresentation(error, { action });
    showNotice(message, kind);
  };

  const checkoutSubscription = async (
    choice: SubscriptionPaymentChoice,
    options?: { auto?: boolean },
  ): Promise<"subscribed" | "needs_funds" | "needs_wallet" | "cancelled"> => {
    await ensureEvmWallet();
    await syncWalletIdentity();

    const wallet = getWalletAddress();
    if (!wallet) {
      setPaymentChoice({ ...choice, walletRequired: true });
      if (!options?.auto) {
        showNotice("Connect your DogeOS wallet, then confirm the subscription.", "payment");
      }
      return "needs_wallet";
    }

    setPaymentChoice({ ...choice, walletRequired: false });

    if (!isWalletLinkedOnSession(wallet)) {
      showNotice("Approve the DogeOS sign-in signature in your wallet to continue.", "payment");
      await linkWalletOnZeroGChain();
    }

    const balance = await readZeroGBalance();
    const funding = formatZeroGShortfall(balance, choice.subscriptionPrice0G);
    if (!funding.sufficient) {
      showNotice(
        `You have ${funding.balanceLabel} but ${choice.subscriptionName ?? "this plan"} costs ${funding.priceLabel}. Top up, then confirm the subscription.`,
        "payment",
      );
      return "needs_funds";
    }

    showNotice(
      `Opening your wallet — confirm ${choice.subscriptionName ?? "Creator subscription"} for ${funding.priceLabel}.`,
      "payment",
    );
    try {
      await purchaseCreatorSubscription(choice.subscriptionTier ?? 1, 1, getEthereumProvider);
    } catch (error) {
      if (isWalletUserAbort(error)) return "cancelled";
      throw error;
    }
    return "subscribed";
  };

  type LegacyPaymentChoice = Extract<NonNullable<typeof paymentChoice>, { billingMode: "legacy" }>;

  const legacyCheckoutKeyRef = useRef<string | null>(null);

  const runLegacyPayThenBuild = async (choice: LegacyPaymentChoice) => {
    try {
      if (choice.chainMethod === "0g" && choice.chainAmount <= 0) {
        setIsPaying(true);
        await ensureEvmWallet();
        await syncWalletIdentity();
        const wallet = getWalletAddress();
        if (!wallet) {
          showNotice("Connect your DogeOS wallet to continue.", "payment");
          return;
        }
        if (!isWalletLinkedOnSession(wallet)) {
          showNotice("Approve the DogeOS sign-in signature in your wallet to continue.", "payment");
          await linkWalletOnZeroGChain();
        }
        showNotice("Signed in. Starting your Hybrid build…", "info");
        setPaymentChoice(null);
        const game = await studio.generateFromPrompt(choice.tier, choice.buildPrompt, {
          method: "0g",
        });
        if (game) addCreatedGame(game);
        setGenerationNotice("");
        return;
      }

      await payWithChain(choice);
    } catch (error: unknown) {
      if (isWalletUserAbort(error)) return;
      showWalletNotice(error, "pay for this game");
    } finally {
      setIsPaying(false);
    }
  };

  const runSubscriptionThenBuild = async (choice: SubscriptionPaymentChoice) => {
    try {
      const result = await checkoutSubscription(choice);
      if (result !== "subscribed") {
        if (result === "cancelled") {
          showNotice(
            "Subscription not completed. Open your wallet and approve the 10 0G payment, then click Subscribe again.",
            "payment",
          );
        }
        return;
      }
    } catch (error) {
      showWalletNotice(error, "subscribe with 0G");
      return;
    }
    showNotice("Subscription active. Starting your game build…", "info");
    setPaymentChoice(null);
    setGenerationNotice("");
    try {
      const game = await studio.generateFromPrompt(choice.tier, choice.buildPrompt);
      if (game) addCreatedGame(game);
    } catch (error: any) {
      showNotice(
        error?.response?.data?.error ??
          error?.message ??
          "Subscription succeeded but the build could not start.",
        "error",
      );
      throw error;
    }
  };

  const build = async (tier: 1 | 2 | 3, promptOverride = "") => {
    if (!requireLogin()) return;
    const pendingInput = chatInput.trim();
    const promptWithPendingInput = [finalPrompt || chatPrompt || studio.prompt, pendingInput]
      .filter(Boolean)
      .join(". ");
    const buildPrompt = promptOverride || promptWithPendingInput;
    if (!buildPrompt.trim() || phase === "building") return;
    setGenerationNotice("");
    setGenerationNoticeKind("info");
    setPaymentChoice(null);
    try {
      await ensureEvmWallet();
      await syncWalletIdentity();
      const game = await studio.generateFromPrompt(tier, buildPrompt);
      if (game) addCreatedGame(game);
    } catch (error: any) {
      const payment = error?.response?.data?.payment;
      const isPaidRequired =
        error?.response?.status === 402 &&
        (error?.response?.data?.code === "PAID_GENERATION_REQUIRED" || Boolean(payment?.required));
      const isWalletRequired =
        error?.response?.status === 402 &&
        error?.response?.data?.code === "EVM_WALLET_REQUIRED";
      const subscription = error?.response?.data?.subscription;
      const isSubscriptionRequired =
        error?.response?.status === 402 &&
        (error?.response?.data?.code === "SUBSCRIPTION_REQUIRED" ||
          error?.response?.data?.code === "GENERATION_QUOTA_EXCEEDED");

      if (isSubscriptionRequired) {
        const requiredTier = (
          subscription?.repurchaseTier === 2 || subscription?.requiredTier === 2 ? 2 : 1
        ) as 1 | 2;
        const tiers = await fetchCreatorSubscriptionTiers().catch(() => null);
        const plan = tiers?.tiers?.find((item) => item.tier === requiredTier);
        const choice: SubscriptionPaymentChoice = {
          tier,
          buildPrompt,
          billingMode: "subscription",
          subscriptionTier: requiredTier,
          subscriptionName: plan?.name ?? subscription?.requiredTierName,
          subscriptionPrice0G: plan?.price0G,
          walletRequired: Boolean(subscription?.walletRequired),
          chainMethod: "0g",
          chainAmount: 0,
          chainCurrency: "0G",
        };
        setPaymentChoice(choice);
        showNotice(
          subscription?.walletRequired
            ? "Sign in with your DogeOS wallet, then confirm your Creator subscription."
            : `Confirm ${plan?.name ?? subscription?.requiredTierName ?? "your Creator subscription"} in your wallet to continue.`,
          "payment",
        );
        const checkoutKey = `${tier}:${buildPrompt}`;
        if (subscriptionCheckoutKeyRef.current !== checkoutKey) {
          subscriptionCheckoutKeyRef.current = checkoutKey;
          void runSubscriptionThenBuild(choice).catch((checkoutError: unknown) => {
            if (isWalletUserAbort(checkoutError)) return;
            showWalletNotice(checkoutError, "subscribe with 0G");
          });
        }
      } else if (isPaidRequired || isWalletRequired) {
        const chain = payment?.methods?.["0g"] ?? payment?.methods?.chain;
        let chainAmount = 0;
        try {
          chainAmount = Number(parseHumanZeroGAmount(chain?.amount ?? payment?.amount ?? 0));
        } catch (amountError: unknown) {
          showNotice(
            amountError instanceof Error
              ? amountError.message
              : "Invalid payment amount from server. Refresh and try again.",
            "error",
          );
          return;
        }
        const tierLabel = tier === 1 ? "Hybrid" : tier === 2 ? "Pro" : "Ultra";
        const choice: LegacyPaymentChoice = {
          tier,
          buildPrompt,
          billingMode: "legacy",
          chainMethod: "0g",
          chainAmount,
          chainCurrency: "0G",
        };
        setPaymentChoice(choice);

        if (chainAmount <= 0 || isWalletRequired) {
          showNotice(
            `Sign in with your DogeOS wallet to start ${tierLabel} (no payment for this tier).`,
            "payment",
          );
        } else {
          showNotice(
            `Confirm ${chainAmount} 0G in your DogeOS wallet to build with ${tierLabel}.`,
            "payment",
          );
        }
        const checkoutKey = `${tier}:${buildPrompt}:${chainAmount}`;
        if (legacyCheckoutKeyRef.current !== checkoutKey) {
          legacyCheckoutKeyRef.current = checkoutKey;
          void runLegacyPayThenBuild(choice);
        }
      } else {
        const serverError = String(error?.response?.data?.error ?? error?.message ?? "").trim();
        if (error?.response?.status === 401 || /authorization token/i.test(serverError)) {
          clearAuthToken();
          void prefetchAuthToken();
          showNotice("Sign in with your DogeOS wallet, then try building again.", "error");
          return;
        }
        showNotice(formatPaidGenerationNotice(error), "error");
      }
    }
  };

  const topUpZeroGWallet = async () => {
    const amount = String(paymentChoice?.chainAmount || paymentChoice?.subscriptionPrice0G || "10");
    try {
      setIsFundingWallet(true);
      await ensureEvmWallet();
      await addZeroGFunds();
      showNotice(
        `Your DogeOS wallet address is copied — send at least ${amount} 0G to it on 0G mainnet, then continue.`,
        "payment",
      );
    } catch (error: any) {
      if (!/cancel/i.test(String(error?.message ?? ""))) {
        showNotice(error?.message ?? "Could not copy your wallet address.", "error");
      }
    } finally {
      setIsFundingWallet(false);
    }
  };

  const publishBuiltGame = async () => {
    if (!builtGameId || publishingGame) return;
    if (!requireLogin()) return;
    try {
      setPublishingGame(true);
      const result = await publishGamePackage(builtGameId);
      if (result.game) addCreatedGame(result.game as any);
      showNotice("Game published! Anyone can play it now.", "info");
    } catch (error: any) {
      showNotice(
        error?.response?.data?.error ?? error?.message ?? "Could not publish this game.",
        "error",
      );
    } finally {
      setPublishingGame(false);
    }
  };

  const subscribeAndBuild = async () => {
    if (!paymentChoice || paymentChoice.billingMode !== "subscription" || isPaying) return;
    const choice = paymentChoice;
    try {
      setIsPaying(true);
      subscriptionCheckoutKeyRef.current = null;
      await runSubscriptionThenBuild(choice);
    } catch (error: unknown) {
      if (isWalletUserAbort(error)) return;
      showWalletNotice(error, "subscribe with 0G");
    } finally {
      setIsPaying(false);
    }
  };

  const payWithChain = async (choiceOverride?: LegacyPaymentChoice) => {
    const choice = choiceOverride ?? paymentChoice;
    if (!choice || isPaying) return;
    const { tier, buildPrompt, chainAmount, chainCurrency } = choice;
    setPaymentChoice(null);
    try {
      setIsPaying(true);
      let paymentTxHash = sessionStorage.getItem(PENDING_CHAIN_GENERATION_PAYMENT_KEY) ?? "";

      await ensureEvmWallet();
      await syncWalletIdentity();
      const wallet = getWalletAddress();
      if (wallet && !isWalletLinkedOnSession(wallet)) {
        showNotice("Approve the DogeOS sign-in signature in your wallet to continue.", "payment");
        await linkWalletOnZeroGChain();
      }

      if (chainAmount <= 0) {
        showNotice("Starting your Hybrid build…", "info");
        const game = await studio.generateFromPrompt(tier, buildPrompt, { method: "0g" });
        if (game) addCreatedGame(game);
        setGenerationNotice("");
        setGenerationNoticeKind("info");
        return;
      }

      if (!paymentTxHash) {
        showNotice(
          `Confirm ${chainAmount} ${chainCurrency} in your DogeOS wallet (on 0G mainnet) to unlock another game.`,
          "payment",
        );
        await ensureEvmWallet();
        paymentTxHash = await sendZeroGGenerationPayment(chainAmount);
        sessionStorage.setItem(PENDING_CHAIN_GENERATION_PAYMENT_KEY, paymentTxHash);
      }
      showNotice("Payment sent. Verifying on 0G mainnet…", "info");
      let game = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          game = await studio.generateFromPrompt(tier, buildPrompt, {
            method: "0g",
            paymentTxHash,
          });
          break;
        } catch (verifyError: any) {
          const waitingForConfirmation =
            verifyError?.response?.status === 402 &&
            verifyError?.response?.data?.code === "PAYMENT_NOT_CONFIRMED";
          if (!waitingForConfirmation || attempt === 2) throw verifyError;
          showNotice("Payment sent. Waiting for 0G confirmation…", "info");
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
      if (game) addCreatedGame(game);
      sessionStorage.removeItem(PENDING_CHAIN_GENERATION_PAYMENT_KEY);
      setGenerationNotice("");
      setGenerationNoticeKind("info");
      return;
    } catch (paymentError: any) {
      showNotice(
        paymentError?.response?.data?.error ??
          paymentError?.message ??
          "Could not complete payment. Please try again.",
        "error",
      );
    } finally {
      setIsPaying(false);
    }
  };

  // Cancel a running build: stop polling, drop the persisted record, and delete
  // the already-saved game entry so nothing half-built lingers in My Creations.
  const cancelBuild = () => {
    const gameId = activeBuild?.game?.id;
    studio.cancelActiveBuild();
    if (phase === "building" && gameId) void removeCreatedGame(gameId);
    resetChat();
    studio.setPrompt("");
    setEnhancedPromptDraft("");
  };

  const sendChatMessage = (text = chatInput) => {
    if (phase === "building") return;
    sendChat(text);
  };

  const submitComposerPrompt = () => {
    const value = chatInput.trim();
    if (phase === "building") return;
    if (!value) return;
    if (chatStage === "ready") {
      submitChatPrompt();
      return;
    }
    sendChatMessage(value);
  };

  const handleCreatePanelSubmit = async () => {
    if (phase === "building" || isThinking || isEnhancingPrompt) return;
    const instruction = chatInput.trim();
    if (!instruction) return;
    if (!requireLogin()) return;

    // First turn the user's short idea into a build-ready specification. Only
    // after the user can see that prompt do we reveal Hybrid, Pro, and Ultra.
    const rawPrompt = instruction;
    setMessages((current) => [...current, { role: "user", text: instruction }]);
    setIsEnhancingPrompt(true);
    setGenerationNotice("");
    try {
      const { data } = await api.post(
        "/agents/enhance-prompt",
        { prompt: rawPrompt },
        // Long, detailed prompts can make MiniMax reason for longer than the
        // shared 12s API timeout. Match the backend's enhancement allowance.
        { timeout: 100_000 },
      );
      const enhancedPrompt = String(data?.enhancedPrompt ?? "").trim();
      if (!enhancedPrompt) throw new Error("Prompt enhancement returned no text.");

      setFinalPrompt(enhancedPrompt);
      setEnhancedPromptDraft(enhancedPrompt);
      setGameRequest(instruction);
      setChatInput("");
      setChatStage("ready");
      studio.setPrompt(enhancedPrompt);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Your detailed game prompt is ready. Review or edit it below, then choose Hybrid, Pro, or Ultra.",
        },
      ]);
    } catch (error: any) {
      showNotice(
        error?.response?.data?.error ??
          error?.message ??
          "Could not enhance the game prompt. Please try again.",
        "error",
      );
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  const startTierBuild = (tier: 1 | 2 | 3) => {
    if (!requireLogin()) return;
    const prompt = [finalPrompt || chatPrompt || studio.prompt, chatInput.trim()]
      .filter(Boolean)
      .join(". ");
    if (!prompt.trim()) return;
    void build(tier, prompt);
  };

  const enhancedGameTitle =
    enhancedPromptDraft.match(/^##\s*Title\s*\n\s*\*\*([^*\n]+)\*\*/i)?.[1]?.trim() ?? "";
  const specLines = Math.max(8, enhancedPromptDraft.split("\n").length);
  const hasBuildPrompt = Boolean(chatInput.trim() || finalPrompt || chatPrompt || studio.prompt);
  const progress =
    phase === "done"
      ? 1
      : phase === "failed"
        ? step / (steps.length - 1)
        : (step + 0.5) / steps.length;

  const noticePanel = generationNotice ? (
    <div ref={noticeRef} className="scroll-mt-20">
      <Panel
        tone={
          generationNoticeKind === "payment"
            ? "amber"
            : generationNoticeKind === "error"
              ? undefined
              : "cyan"
        }
        title={
          generationNoticeKind === "payment"
            ? "payment_required"
            : generationNoticeKind === "error"
              ? "build_error"
              : "notice"
        }
        className={generationNoticeKind === "error" ? "[--panel-line:#6b231e]" : ""}
      >
        <Notice kind={generationNoticeKind}>{generationNotice}</Notice>

        {generationNoticeKind === "payment" && paymentChoice && (
          <div className="mt-3 space-y-3">
            <div className="border-2 border-line bg-ink-1 p-3">
              <DogeOSWalletPanel showHeading={false} />
            </div>
            {paymentChoice.billingMode === "subscription" ? (
              <div className="grid gap-2">
                <Btn
                  variant="magenta"
                  size="lg"
                  onClick={() => void subscribeAndBuild()}
                  disabled={isPaying}
                  className="h-auto flex-col gap-1 py-3"
                >
                  <span>
                    {paymentChoice.walletRequired
                      ? "Connect wallet & subscribe"
                      : subscriptionFunded
                        ? `Confirm in wallet · ${paymentChoice.subscriptionPrice0G ?? ""} 0G`
                        : `${paymentChoice.subscriptionName ?? "Subscribe"} · ${paymentChoice.subscriptionPrice0G ?? ""} 0G`}
                  </span>
                  <span className="text-[10px] font-bold normal-case tracking-normal opacity-80">
                    {paymentChoice.walletRequired
                      ? "Sign in with DogeOS, then confirm the subscription"
                      : subscriptionFunded
                        ? "Your balance covers this — approve the transaction"
                        : "30 days of game generation"}
                  </span>
                </Btn>
                {subscriptionFunded !== true && (
                  <Btn
                    variant="cyan"
                    onClick={() => void topUpZeroGWallet()}
                    disabled={isFundingWallet || isPaying}
                  >
                    {isFundingWallet ? "Copying address…" : "Top up 0G wallet first"}
                  </Btn>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Btn
                  variant="cyan"
                  onClick={() => void payWithChain()}
                  disabled={isPaying}
                  className="col-span-2 h-auto flex-col gap-0.5 py-2.5"
                >
                  <span>
                    ◆ {paymentChoice.chainAmount} {paymentChoice.chainCurrency}
                  </span>
                  <span className="text-[9px] opacity-80">
                    Pay 0G from your DogeOS wallet
                  </span>
                </Btn>
                <Btn
                  variant="ghost"
                  onClick={() => void topUpZeroGWallet()}
                  disabled={isFundingWallet || isPaying}
                  className="col-span-2"
                >
                  {isFundingWallet ? "Copying address…" : "Top up 0G first"}
                </Btn>
              </div>
            )}
          </div>
        )}
        {generationNoticeKind === "payment" && !paymentChoice && (
          <p className="mt-2 text-xs text-text-3">
            Your first game is free. Additional generations require payment.
          </p>
        )}
      </Panel>
    </div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6 lg:px-8 lg:pt-7">
      <header className="create-hero mb-6 border-2 border-line px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <div className="relative shrink-0">
              <span
                aria-hidden="true"
                className="doge-halo-pulse absolute -inset-3 rounded-[28px] bg-doge/25 blur-xl"
              />
              <DogeIcon
                size={84}
                bob
                className="doge-halo relative hidden rounded-[22px] sm:block"
              />
              <DogeIcon size={60} bob className="doge-halo relative rounded-[16px] sm:hidden" />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[12px] text-text-3">
                <span className="text-phos">$</span> ./create --interactive
              </p>
              <h1 className="font-pixel mt-2 text-[20px] leading-tight sm:text-[30px]">
                <span className="text-gradient-doge">NEW BUILD</span>
                <span className="text-magenta">.</span>
              </h1>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-2 sm:text-[14px]">
                Turn one line into a playable game. AI agents write the code, playtest it and ship
                it — on DogeOS.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {["⚡ Builds in minutes", "🤖 AI agents", "🎮 Instantly playable"].map((chip) => (
                  <span
                    key={chip}
                    className="border-2 border-line-2 bg-ink-0/60 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] text-text-2"
                  >
                    {chip}
                  </span>
                ))}
                <DogeOSBadge className="hidden sm:inline-flex" />
              </div>
            </div>
          </div>

          <ol className="grid grid-cols-3 gap-2 lg:w-[380px] lg:shrink-0" aria-label="Build progress">
            {CREATE_STEPS.map((step, index) => {
              const state = index < stepIndex ? "done" : index === stepIndex ? "active" : "todo";
              return (
                <li
                  key={step.label}
                  className={cn(
                    "border-2 px-2.5 py-2.5 transition-colors",
                    state === "active" && "border-doge bg-doge/10 shadow-[0_0_24px_-8px_var(--doge)]",
                    state === "done" && "border-phos-3 bg-phos/5",
                    state === "todo" && "border-line bg-ink-0/50",
                  )}
                >
                  <span
                    className={cn(
                      "font-term block text-[26px] leading-none",
                      state === "active" ? "text-doge" : state === "done" ? "text-phos" : "text-text-3",
                    )}
                  >
                    {state === "done" ? "✓" : `0${index + 1}`}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block font-mono text-[11px] font-extrabold uppercase tracking-[0.1em]",
                      state === "todo" ? "text-text-3" : "text-text",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block truncate text-[10px] text-text-3">{step.note}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div className="lg:hidden">{noticePanel}</div>

          <Panel
            tone="hot"
            title={
              <span className="flex items-center gap-2">
                <PixelIcon name="terminal" size={12} />
                {templateSeed ? "remix_session.log" : "session.log"}
              </span>
            }
            actions={
              templateSeed ? (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/templates" })}
                  className="font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] hover:underline"
                  title="Change template"
                >
                  base: {templateSeed.name} ›
                </button>
              ) : null
            }
          >
            <div
              ref={chatScrollRef}
              className="max-h-[min(46vh,380px)] min-h-[140px] overflow-y-auto pr-1"
            >
              <ConsoleChatMessages
                messages={messages}
                chatStage={chatStage}
                isThinking={isThinking}
                onQuickReply={sendChatMessage}
                disabled={phase === "building"}
              />
              {isEnhancingPrompt && (
                <p className="mt-2.5 font-mono text-[13px] text-amber">
                  <span className="font-bold text-phos">dogegame-bot ▸</span> <Spinner /> expanding your
                  idea into a full game spec…
                </p>
              )}
            </div>

            <CreateConsolePanel
              className="mt-4"
              value={chatInput}
              onChange={setChatInput}
              onSubmit={handleCreatePanelSubmit}
              onCategoryPick={sendChatMessage}
              disabled={phase === "building" || isThinking || isEnhancingPrompt}
              placeholder={
                chatStage === "ready"
                  ? "Add a detail, or pick a build mode…"
                  : "Describe your game idea…"
              }
              submitLabel={chatStage === "ready" ? "Refine" : "Expand"}
              hideCategories={chatStage === "ready"}
            />
          </Panel>

          {chatStage === "ready" && enhancedPromptDraft && (
            <Panel
              tone="cyan"
              title={
                <span className="flex items-center gap-2">
                  <PixelIcon name="code" size={12} />
                  spec.md
                </span>
              }
              actions={
                <span className="font-mono text-[10px] text-cyan">
                  {phase === "building" ? "read-only · building" : "editable"}
                </span>
              }
              bodyClassName="p-0"
            >
              {enhancedGameTitle && (
                <div className="flex items-center gap-3 border-b-2 border-line px-4 py-3">
                  <span className="label-term text-text-3">title</span>
                  <h3 className="font-pixel min-w-0 truncate text-[12px] text-cyan">
                    {enhancedGameTitle}
                  </h3>
                </div>
              )}
              <div className="flex max-h-[360px] overflow-y-auto bg-ink-0">
                <div
                  aria-hidden="true"
                  className="select-none border-r-2 border-line px-2.5 py-3 text-right font-mono text-[12px] leading-6 text-text-3"
                >
                  {Array.from({ length: specLines }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={enhancedPromptDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEnhancedPromptDraft(value);
                    setFinalPrompt(value);
                    studio.setPrompt(value);
                  }}
                  disabled={phase === "building"}
                  rows={specLines}
                  spellCheck={false}
                  aria-label="Editable enhanced game prompt"
                  className="min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-3 py-3 font-mono text-[12px] leading-6 text-text caret-cyan outline-none disabled:opacity-80"
                />
              </div>
            </Panel>
          )}

          {canPickBuildTier && (
            <section aria-label="Build mode">
              <p className="font-pixel mb-3 text-[11px] text-text">
                {phase === "done" || phase === "failed" ? "BUILD ANOTHER" : "SELECT BUILD MODE"}
                <span className="animate-blink text-phos">_</span>
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {tierButtons.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    onClick={() => startTierBuild(t.tier)}
                    disabled={isPaying || !hasBuildPrompt}
                    className="tier-card group flex min-h-[150px] flex-col border-2 border-line p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ ["--tier" as string]: TONE_VAR[t.tone] }}
                  >
                    <span className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-2.5", TONE_TEXT[t.tone])}>
                        <span className="tier-icon grid size-9 place-items-center border-2">
                          <PixelIcon name={t.icon} size={16} />
                        </span>
                        <span className="font-pixel text-[13px]">{t.label}</span>
                      </span>
                      <Tag tone={t.tone}>{t.speed}</Tag>
                    </span>
                    <span className="mt-3 flex-1 text-[12px] leading-snug text-text-2">
                      {isPaying && buildingTier === t.tier ? "Waiting for payment..." : t.subtitle}
                    </span>
                    <span className="mt-3 flex items-center justify-between font-mono text-[10px] font-extrabold uppercase tracking-[0.1em]">
                      <span className="text-text-3">
                        {tierQuotaHint(generationQuota, t.tier) ?? `tier ${t.tier}`}
                      </span>
                      <span
                        className={cn(
                          "opacity-0 transition-opacity group-hover:opacity-100",
                          TONE_TEXT[t.tone],
                        )}
                      >
                        ▶ start
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-[68px]">
          <div className="hidden lg:block">{noticePanel}</div>

          {phase === "idle" ? (
            <div className="hidden space-y-3 lg:block">
              <div className="flex items-center justify-between">
                <p className="font-pixel text-[11px] text-text">BUILD MODES</p>
                <span className="label-term text-text-3">pick after your spec</span>
              </div>
              {tierButtons.map((t) => (
                <div
                  key={t.tier}
                  className="tier-card border-2 border-line p-3.5"
                  style={{ ["--tier" as string]: TONE_VAR[t.tone] }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("flex items-center gap-2.5", TONE_TEXT[t.tone])}>
                      <span className="tier-icon grid size-9 place-items-center border-2">
                        <PixelIcon name={t.icon} size={15} />
                      </span>
                      <span className="font-pixel text-[12px]">{t.label}</span>
                    </span>
                    <Tag tone={t.tone}>{t.speed}</Tag>
                  </div>
                  <p className="mt-2.5 text-[12px] leading-snug text-text-2">{t.subtitle}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {t.perks.map((perk) => (
                      <li
                        key={perk}
                        className="border border-line-2 bg-ink-0/60 px-1.5 py-0.5 font-mono text-[10px] text-text-3"
                      >
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="flex items-start gap-3 border-2 border-dashed border-doge-2 bg-doge/5 p-3.5">
                <DogeIcon size={40} className="rounded-[11px]" />
                <p className="text-[12px] leading-relaxed text-text-2">
                  <span className="font-bold text-doge">Pro tip:</span> name the genre, the controls
                  and how you win — e.g. “tap to jump, dodge spikes, beat 60 seconds”.
                </p>
              </div>
            </div>
          ) : (
            <Panel
              tone={phase === "done" ? "phos" : phase === "failed" ? undefined : "amber"}
              className={phase === "failed" ? "[--panel-line:#6b231e]" : ""}
              title={
                <span className="flex items-center gap-2">
                  {phase === "building" ? <Spinner /> : <PixelIcon name="terminal" size={12} />}
                  build.log
                </span>
              }
              actions={
                <button
                  type="button"
                  onClick={cancelBuild}
                  className={cn(
                    "font-mono text-[10px] font-extrabold uppercase tracking-[0.1em] hover:underline",
                    phase === "building" ? "text-danger" : "",
                  )}
                >
                  {phase === "building" ? "^C cancel" : "dismiss ×"}
                </button>
              }
            >
              <div className="flex items-baseline justify-between gap-3 font-mono text-[11px]">
                <span className="min-w-0 truncate text-text-2">
                  {phase === "done"
                    ? "AI build ready"
                    : phase === "failed"
                      ? "Build failed"
                      : (activeBuild?.statusText ?? studio.agentStatus)}
                </span>
                {phase === "building" && (
                  <span className="font-term shrink-0 text-[22px] leading-none text-amber">
                    {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:
                    {String(elapsedSec % 60).padStart(2, "0")}
                  </span>
                )}
              </div>

              <Meter
                className="mt-3"
                value={progress}
                segments={16}
                tone={phase === "failed" ? "danger" : phase === "done" ? "phos" : "amber"}
                label="Build progress"
              />

              <ol className="mt-4 space-y-2 font-mono text-[12px]">
                {steps.map((s, i) => {
                  const active = phase === "building" && i === step;
                  const complete = phase === "done" || i < step;
                  const failedHere = phase === "failed" && i === step;
                  return (
                    <li key={s} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "w-12 shrink-0 font-bold",
                          complete && "text-phos",
                          active && "text-amber",
                          failedHere && "text-danger",
                          !complete && !active && !failedHere && "text-text-3",
                        )}
                      >
                        {complete ? (
                          "[ OK ]"
                        ) : active ? (
                          <>
                            [ <Spinner /> ]
                          </>
                        ) : failedHere ? (
                          "[FAIL]"
                        ) : (
                          "[    ]"
                        )}
                      </span>
                      <span className={complete || active ? "text-text" : "text-text-3"}>{s}</span>
                    </li>
                  );
                })}
              </ol>

              {phase === "failed" && (
                <Notice kind="error" className="mt-4">
                  {activeBuild?.statusText ?? "The AI build failed."}{" "}
                  {builtGame?.id && activeBuild?.strategy !== "pure-agent"
                    ? "The playable template version is still in My Creations — run the build again to retry the AI version."
                    : "Run the build again from this page to retry."}
                </Notice>
              )}

              {phase === "done" && (
                <div className="mt-4 border-2 border-phos bg-phos/10 p-3">
                  <p className="label-term text-phos">AI build ready</p>
                  <h4 className="font-pixel mt-2 text-[13px] leading-snug text-text">
                    {builtGame?.title ?? studio.generatedPackage.title}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Btn
                      variant="primary"
                      className="col-span-2"
                      size="lg"
                      onClick={() => {
                        if (!builtGameId) return;
                        navigate({ to: "/play", search: { gameId: builtGameId } });
                      }}
                      disabled={!builtGameId}
                    >
                      <PixelIcon name="play" size={12} /> Play
                    </Btn>
                    <Btn
                      onClick={() => {
                        if (!builtGameId) return;
                        navigate({ to: "/edit/$gameId", params: { gameId: builtGameId } });
                      }}
                      disabled={!builtGameId}
                    >
                      <PixelIcon name="code" size={12} /> Edit
                    </Btn>
                    <Btn
                      variant="magenta"
                      onClick={() => void publishBuiltGame()}
                      disabled={!builtGameId || publishingGame}
                    >
                      {publishingGame ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PixelIcon name="send" size={12} />
                      )}
                      {publishingGame ? "Publishing…" : "Publish"}
                    </Btn>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
