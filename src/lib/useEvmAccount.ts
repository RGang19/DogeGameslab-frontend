import { useAccount, useConnectors, useWalletConnect } from "@dogeos/dogeos-sdk";
import type { Eip1193Provider } from "ethers";
import { useCallback, useEffect, useState } from "react";

function isEvmAddress(value?: string | null): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function isDogecoinAddress(value?: string | null): value is string {
  return Boolean(value && /^[Dn][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value));
}

/** `useAccount().chainId` is CAIP ("eip155:6281971"); chain configs use plain numbers. */
export function numericChainId(value: unknown): number | null {
  const match = String(value ?? "").match(/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function signatureToHex(signature: string | Uint8Array) {
  if (typeof signature === "string") return signature;
  return `0x${Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function utf8ToHex(text: string) {
  return `0x${Array.from(new TextEncoder().encode(text), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The connected wallet's EVM (DogeOS) account — the app's identity.
 *
 * Wallets such as MyDoge can be connected on their Dogecoin side; the account
 * key is still the wallet's EVM address, so in that case it is read from the
 * wallet's EVM connector. Signing always uses EVM `personal_sign`, which is
 * what the backend verifies.
 */
export function useEvmAccount() {
  const { isConnected } = useWalletConnect();
  const { address, chainType, chainId, currentProvider, currentWallet, signMessage } = useAccount();
  const { connectors } = useConnectors();

  const onEvm = chainType === "evm";
  const evmProvider = (onEvm ? currentProvider : connectors?.evm?.provider) as
    | Eip1193Provider
    | null
    | undefined;
  const [linkedEvmAddress, setLinkedEvmAddress] = useState<string | null>(null);

  // Connected on a non-EVM side (e.g. MyDoge's Dogecoin account): look up the
  // same wallet's EVM account.
  useEffect(() => {
    if (!isConnected || onEvm || !evmProvider) {
      setLinkedEvmAddress(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let accounts = (await evmProvider.request({ method: "eth_accounts" })) as string[];
        if (!accounts?.length) {
          accounts = (await evmProvider.request({ method: "eth_requestAccounts" })) as string[];
        }
        const first = accounts?.find(isEvmAddress);
        if (!cancelled) setLinkedEvmAddress(first ? first.toLowerCase() : null);
      } catch {
        if (!cancelled) setLinkedEvmAddress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evmProvider, isConnected, onEvm, address]);

  const evmAddress = !isConnected
    ? null
    : onEvm
      ? isEvmAddress(address)
        ? address.toLowerCase()
        : null
      : linkedEvmAddress;

  // Dogecoin-only wallets (MyDoge's extension exposes just `window.doge`) sign
  // in with their Dogecoin address; the backend verifies Dogecoin signatures.
  const dogecoinAddress =
    isConnected && chainType === "dogecoin" && isDogecoinAddress(address) ? address : null;
  const accountAddress = evmAddress ?? dogecoinAddress;

  const signWithEvm = useCallback(
    async (message: string) => {
      if (!evmAddress) throw new Error("Connect a DogeOS (EVM) wallet account to sign in.");
      if (onEvm && signMessage) return signatureToHex(await signMessage({ message }));
      if (!evmProvider) throw new Error("This wallet has no DogeOS (EVM) account.");
      const signature = await evmProvider.request({
        method: "personal_sign",
        params: [utf8ToHex(message), evmAddress],
      });
      return signatureToHex(signature as string);
    },
    [evmAddress, evmProvider, onEvm, signMessage],
  );

  /** Signs the sign-in message with whichever account is the identity. */
  const signForSignIn = useCallback(
    async (message: string) => {
      if (evmAddress) return signWithEvm(message);
      if (dogecoinAddress && signMessage) {
        const signature = await signMessage({ message });
        if (typeof signature === "string") return signature;
        return btoa(String.fromCharCode(...signature));
      }
      throw new Error("Connect your wallet to sign in.");
    },
    [dogecoinAddress, evmAddress, signMessage, signWithEvm],
  );

  return {
    isConnected,
    /** The account key: DogeOS 0x address, or the Dogecoin address for Dogecoin-only wallets. */
    accountAddress,
    dogecoinAddress,
    signForSignIn,
    evmAddress,
    evmProvider: evmProvider ?? null,
    /** True when the wallet is connected but exposes no EVM account. */
    missingEvmAccount: isConnected && !evmAddress,
    chainType,
    chainIdNumber: numericChainId(chainId),
    walletName: currentWallet?.info?.name ?? null,
    signWithEvm,
  };
}
