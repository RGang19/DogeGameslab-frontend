import { useAccount, useWalletConnect } from "@dogeos/dogeos-sdk";
import { useCallback, useMemo, useRef, useState } from "react";

import { clearAuthToken, registerWalletSigner } from "@/lib/api";
import { DOGEOS_CLIENT_ID } from "@/lib/dogeos";
import { clearAllBrowserStorage, clearAllClientCookies } from "@/lib/fullLogout";
import { clearWalletIdentity, getWalletAddress, setWalletIdentity } from "@/lib/identity";
import { useDogeWallet } from "@/lib/useDogeWallet";

export type StudioAuthStatus = "idle" | "error";

export type StudioUser = { id: string; address: string; walletName: string | null };

/** Shared DogeOS login flow: email, Google, X, or an external wallet such as MyDoge. */
export function useStudioAuth() {
  const { isConnected, isConnecting, connectionStatus, error, openModal, disconnect } =
    useWalletConnect();
  const { address, chainType, currentWallet } = useAccount();
  const { linkWalletOnZeroGChain } = useDogeWallet();
  const [authStatus, setAuthStatus] = useState<StudioAuthStatus>("idle");
  const signingOutRef = useRef(false);

  const evmAddress =
    isConnected && chainType === "evm" && address && /^0x[a-fA-F0-9]{40}$/.test(address)
      ? address.toLowerCase()
      : null;
  const walletName = currentWallet?.info?.name ?? null;

  const user = useMemo<StudioUser | null>(
    () => (evmAddress ? { id: evmAddress, address: evmAddress, walletName } : null),
    [evmAddress, walletName],
  );

  const openLogin = useCallback(async () => {
    setAuthStatus("idle");
    openModal();
  }, [openModal]);

  const syncWalletIdentity = useCallback(async () => {
    if (!evmAddress) return getWalletAddress();
    setWalletIdentity({ walletAddress: evmAddress, walletName });
    return evmAddress;
  }, [evmAddress, walletName]);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    registerWalletSigner(null);
    clearAuthToken();
    clearWalletIdentity();
    try {
      await Promise.race([
        disconnect(),
        new Promise<void>((resolve) => window.setTimeout(() => resolve(), 2500)),
      ]);
    } catch {
      setAuthStatus("error");
    }

    clearAllBrowserStorage();
    clearAllClientCookies();

    // Back to this app's home page.
    window.location.replace(import.meta.env.BASE_URL);
  }, [disconnect]);

  const signInLabel = authStatus === "error" || error ? "Try again" : "Sign in";
  const signInHint = "Sign in with DogeOS — email, Google, X, or your MyDoge wallet";

  return {
    configured: Boolean(DOGEOS_CLIENT_ID),
    ready: connectionStatus !== "connecting",
    authenticated: Boolean(evmAddress),
    user,
    authLoading: isConnecting,
    authStatus,
    signInLabel,
    signInHint,
    openLogin,
    signOut,
    syncWalletIdentity,
    linkWalletOnZeroGChain,
  };
}
