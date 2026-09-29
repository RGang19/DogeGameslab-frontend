import { BrowserProvider, Contract, getAddress, type Eip1193Provider } from "ethers";
import { api, getTokenEvmWallet } from "../api";
import { getWalletAddress } from "../identity";
import { formatWalletError } from "../walletErrors";

const SUBSCRIPTION_ABI = ["function subscribe(uint8 tier, uint8 periods) payable"] as const;

export type CreatorSubscriptionTier = {
  tier: 0 | 1 | 2;
  name: string;
  priceWei: string;
  price0G: string;
};

export type CreatorSubscriptionTiers = {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  explorerUrl: string;
  periodDays: number;
  tiers: CreatorSubscriptionTier[];
};

const TIERS_CACHE_TTL_MS = 5 * 60_000;
let tiersCache: CreatorSubscriptionTiers | null = null;
let tiersCacheExpiresAt = 0;
let tiersFetchPromise: Promise<CreatorSubscriptionTiers> | null = null;

export async function fetchCreatorSubscriptionTiers(
  options?: { force?: boolean },
): Promise<CreatorSubscriptionTiers> {
  const force = options?.force ?? false;
  if (!force && tiersCache && Date.now() < tiersCacheExpiresAt) {
    return tiersCache;
  }

  if (!force && tiersFetchPromise) {
    return tiersFetchPromise;
  }

  tiersFetchPromise = api
    .get("/creator-subscription/tiers")
    .then(({ data }) => {
      tiersCache = data as CreatorSubscriptionTiers;
      tiersCacheExpiresAt = Date.now() + TIERS_CACHE_TTL_MS;
      return tiersCache;
    })
    .finally(() => {
      tiersFetchPromise = null;
    });

  return tiersFetchPromise;
}

export async function fetchMyCreatorSubscription() {
  const { data } = await api.get("/creator-subscription/me");
  return data.subscription;
}

export type PaymentTransaction = {
  id: string;
  kind: "subscription" | "generation";
  txHash: string;
  label: string;
  amount0G: string;
  periods: number | null;
  createdAt: string | null;
  explorerUrl: string;
};

export async function fetchMyPaymentTransactions(): Promise<PaymentTransaction[]> {
  const { data } = await api.get("/creator-subscription/transactions");
  return data.transactions ?? [];
}

async function ensureChain(config: CreatorSubscriptionTiers, provider: Eip1193Provider) {
  const chainId = `0x${config.chainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error: unknown) {
    if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 4902) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: "0G Mainnet",
          nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: [config.explorerUrl],
        },
      ],
    });
  }
}

export async function purchaseCreatorSubscription(
  tier: 1 | 2,
  periods = 1,
  getEthereumProvider: () => Promise<Eip1193Provider>,
) {
  const config = await fetchCreatorSubscriptionTiers();
  const eip1193Provider = await getEthereumProvider();
  if (!eip1193Provider) throw new Error("Connect your DogeOS wallet to subscribe with 0G.");
  await ensureChain(config, eip1193Provider);

  const provider = new BrowserProvider(eip1193Provider);
  const signer = await provider.getSigner();
  const signerAddress = getAddress(await signer.getAddress());
  // The signed JWT is authoritative for billing. Local wallet identity syncing
  // may briefly lag behind after sign-in.
  const authenticatedWallet = getTokenEvmWallet() ?? getWalletAddress();
  if (!authenticatedWallet) {
    throw new Error("Sign in with your DogeOS wallet before subscribing.");
  }
  if (getAddress(authenticatedWallet) !== signerAddress) {
    throw new Error("The selected 0G wallet does not match your signed-in Creator Studio wallet.");
  }

  const { data } = await api.post("/creator-subscription/quote", { tier, periods });
  const quote = data.quote;
  const subscription = new Contract(config.contractAddress, SUBSCRIPTION_ABI, signer);

  let transaction;
  try {
    transaction = await subscription.subscribe(tier, periods, {
      value: BigInt(quote.dueNowWei),
    });
    await transaction.wait();
  } catch (error) {
    const friendly = new Error(formatWalletError(error, { action: "subscribe with 0G" }));
    (friendly as Error & { cause?: unknown }).cause = error;
    throw friendly;
  }

  const confirmation = await api.post("/creator-subscription/confirm", {
    txHash: transaction.hash,
  });
  return {
    txHash: transaction.hash as string,
    quote,
    subscription: confirmation.data.subscription,
  };
}
