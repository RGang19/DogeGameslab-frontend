import { ChainTypeEnum, useAccount, useConnectors, useWalletConnect } from "@dogeos/dogeos-sdk";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { useCallback } from "react";

import { prefetchAuthToken } from "@/lib/api";
import { dogeOSChain, fetchDogeOSBalance, zeroGChain } from "@/lib/dogeos";
import { getWalletAddress } from "@/lib/identity";
import { isWalletLinkedOnSession } from "@/lib/walletLink";
import { formatWalletError } from "@/lib/walletErrors";
import { fetchZeroGBalance } from "@/lib/zeroGWallet";
import {
  humanZeroGToWei,
  parseHumanZeroGAmount,
  ZERO_G_FUNDING_URL,
  ZERO_G_TREASURY_WALLET,
} from "@/lib/zeroGChain";

export type DogecoinBalance = { confirmed: number; unconfirmed: number; total: number };

type DogecoinProvider = { getBalance?: () => Promise<DogecoinBalance> };

function isEvmAddress(value?: string | null): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

/**
 * The connected DogeOS wallet: identity on DogeOS, and the payer for 0G
 * generations/subscriptions (it switches to 0G mainnet to send payments).
 */
export function useDogeWallet() {
  const { isConnected, openModal } = useWalletConnect();
  const { address, chainType, chainId, currentProvider, currentWallet, switchChain } = useAccount();
  const { connectors } = useConnectors();

  const evmAddress =
    isConnected && chainType === "evm" && isEvmAddress(address) ? address.toLowerCase() : null;
  const walletAddress = evmAddress ?? getWalletAddress();
  const walletName = currentWallet?.info?.name ?? null;
  const isEmbeddedWallet = Boolean((currentWallet as { isEmbeddedWallet?: boolean } | null)?.isEmbeddedWallet);

  const requireWallet = useCallback(() => {
    if (!evmAddress || !currentProvider) {
      openModal();
      throw new Error("Connect your DogeOS wallet to continue.");
    }
    return { address: evmAddress, provider: currentProvider as unknown as Eip1193Provider };
  }, [currentProvider, evmAddress, openModal]);

  const switchToChain = useCallback(
    async (chain: typeof dogeOSChain | typeof zeroGChain) => {
      const { provider } = requireWallet();
      if (Number(chainId) === chain.id) return provider;
      await switchChain({ chainType: ChainTypeEnum.EVM, chainInfo: chain });
      return provider;
    },
    [chainId, requireWallet, switchChain],
  );

  /** The wallet's EIP-1193 provider, switched to 0G mainnet for payments. */
  const getEthereumProvider = useCallback(() => switchToChain(zeroGChain), [switchToChain]);

  const switchToDogeOS = useCallback(() => switchToChain(dogeOSChain), [switchToChain]);

  const ensureEvmWallet = useCallback(async () => {
    const { address: connected } = requireWallet();
    return { address: connected, walletClientType: walletName ?? "dogeos" };
  }, [requireWallet, walletName]);

  const readZeroGBalance = useCallback(async () => {
    return walletAddress ? fetchZeroGBalance(walletAddress) : 0n;
  }, [walletAddress]);

  const readDogeOSBalance = useCallback(async () => {
    return walletAddress ? fetchDogeOSBalance(walletAddress) : 0n;
  }, [walletAddress]);

  /** Dogecoin L1 balance (satoshis) when the wallet exposes a Dogecoin account. */
  const readDogecoinBalance = useCallback(async (): Promise<DogecoinBalance | null> => {
    const provider = (connectors as { dogecoin?: { provider?: DogecoinProvider } & DogecoinProvider } | null)
      ?.dogecoin;
    const dogecoin = provider?.provider ?? provider;
    if (typeof dogecoin?.getBalance !== "function") return null;
    return dogecoin.getBalance();
  }, [connectors]);

  /**
   * There is no in-app on-ramp for 0G: copy the address so the user can send
   * 0G to it, and open the configured funding page when there is one.
   */
  const addZeroGFunds = useCallback(async () => {
    const { address: connected } = requireWallet();
    await navigator.clipboard?.writeText(connected).catch(() => undefined);
    if (ZERO_G_FUNDING_URL) window.open(ZERO_G_FUNDING_URL, "_blank", "noopener,noreferrer");
    return { method: "copy" as const, address: connected };
  }, [requireWallet]);

  const sendZeroGGenerationPayment = useCallback(
    async (amount0G: number | string) => {
      if (!/^0x[a-fA-F0-9]{40}$/.test(ZERO_G_TREASURY_WALLET)) {
        throw new Error("0G treasury wallet is not configured.");
      }
      const humanAmount = parseHumanZeroGAmount(amount0G);
      try {
        const provider = await getEthereumProvider();
        const signer = await new BrowserProvider(provider).getSigner();
        const tx = await signer.sendTransaction({
          to: ZERO_G_TREASURY_WALLET,
          value: humanZeroGToWei(humanAmount),
        });
        return tx.hash;
      } catch (error) {
        throw new Error(formatWalletError(error, { action: `pay ${humanAmount} 0G` }));
      }
    },
    [getEthereumProvider],
  );

  /** Makes sure the studio JWT belongs to this wallet (prompts one signature if not). */
  const linkWalletOnZeroGChain = useCallback(async () => {
    const { address: connected } = requireWallet();
    if (!isWalletLinkedOnSession(connected)) await prefetchAuthToken(true);
    return connected;
  }, [requireWallet]);

  return {
    isConnected: Boolean(evmAddress),
    walletAddress,
    walletName,
    isEmbeddedWallet,
    chainId: chainId ? Number(chainId) : null,
    hasEvmWallet: Boolean(evmAddress),
    walletLinkedOnSession: isWalletLinkedOnSession(walletAddress),
    openWalletModal: openModal,
    ensureEvmWallet,
    getEthereumProvider,
    switchToDogeOS,
    readZeroGBalance,
    readDogeOSBalance,
    readDogecoinBalance,
    addZeroGFunds,
    sendZeroGGenerationPayment,
    linkWalletOnZeroGChain,
  };
}
