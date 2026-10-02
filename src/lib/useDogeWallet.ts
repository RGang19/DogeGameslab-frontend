import { ChainTypeEnum, useAccount, useConnectors, useWalletConnect } from "@dogeos/dogeos-sdk";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import { useCallback } from "react";

import { useEvmAccount } from "@/lib/useEvmAccount";

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

/**
 * The connected DogeOS wallet: identity on DogeOS, and the payer for 0G
 * generations/subscriptions (it switches to 0G mainnet to send payments).
 */
export function useDogeWallet() {
  const { isConnected, openModal } = useWalletConnect();
  const { chainType, currentWallet, switchChain } = useAccount();
  const { connectors } = useConnectors();
  const { evmAddress, evmProvider, chainIdNumber, walletName, dogecoinAddress } = useEvmAccount();

  const walletAddress = evmAddress ?? getWalletAddress();
  const isEmbeddedWallet = Boolean(
    (currentWallet as { isEmbeddedWallet?: boolean } | null)?.isEmbeddedWallet,
  );

  const requireWallet = useCallback(() => {
    if (dogecoinAddress && !evmAddress) {
      // MyDoge's extension only has a Dogecoin account; 0G payments need an EVM one.
      throw new Error(
        "Paying in 0G needs a DogeOS (0x) wallet. Your MyDoge account is Dogecoin-only — sign in with DogeOS email, Google or X to pay.",
      );
    }
    if (!evmAddress || !evmProvider) {
      openModal();
      throw new Error("Connect your DogeOS wallet to continue.");
    }
    return { address: evmAddress, provider: evmProvider };
  }, [dogecoinAddress, evmAddress, evmProvider, openModal]);

  const switchToChain = useCallback(
    async (chain: typeof dogeOSChain | typeof zeroGChain) => {
      const { provider } = requireWallet();
      if (chainType === "evm") {
        // chainId from the SDK is CAIP ("eip155:16661"); compare the number only.
        if (chainIdNumber === chain.id) return provider;
        await switchChain({ chainType: ChainTypeEnum.EVM, chainInfo: chain });
        return provider;
      }
      // Connected on a non-EVM side (e.g. MyDoge's Dogecoin account): switch the
      // wallet's EVM provider directly.
      const hexId = `0x${chain.id.toString(16)}`;
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexId }],
        });
      } catch (error) {
        if ((error as { code?: number })?.code !== 4902) throw error;
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexId,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [...chain.rpcUrls.default.http],
              blockExplorerUrls: chain.blockExplorers ? [chain.blockExplorers.default.url] : [],
            },
          ],
        });
      }
      return provider;
    },
    [chainIdNumber, chainType, requireWallet, switchChain],
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
    const provider = (
      connectors as { dogecoin?: { provider?: DogecoinProvider } & DogecoinProvider } | null
    )?.dogecoin;
    const dogecoin = provider?.provider ?? provider;
    if (typeof dogecoin?.getBalance !== "function") return null;
    // Wallets differ: DogeOS returns { confirmed, unconfirmed, total }; MyDoge's
    // `window.doge` returns { balance } (in koinu, 1e-8 DOGE). Normalise both.
    const raw = (await dogecoin.getBalance()) as unknown as Record<string, unknown> | null;
    const num = (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const total = num(raw?.total) ?? num(raw?.balance) ?? null;
    if (total === null) return null;
    const confirmed = num(raw?.confirmed) ?? total;
    return { confirmed, unconfirmed: num(raw?.unconfirmed) ?? 0, total };
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
    chainId: chainIdNumber,
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
