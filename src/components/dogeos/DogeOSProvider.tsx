import { useAccount, useWalletConnect, WalletConnectProvider } from "@dogeos/dogeos-sdk";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";

import {
  clearAuthToken,
  hasUsableCachedToken,
  prefetchAuthToken,
  registerWalletSigner,
} from "@/lib/api";
import { buildDogeOSConfig, DOGEOS_CLIENT_ID, wagmiConfig } from "@/lib/dogeos";
import { clearWalletIdentity, setWalletIdentity } from "@/lib/identity";
import { queryClient } from "@/lib/queryClient";

// The SDK injects its own Tailwind build (<style id="__wallet-connect-kit-styles__">)
// at the END of <head>, so its `.hidden`, `.flex`… would override the app's
// responsive utilities (e.g. `hidden lg:flex`). Keep it first in <head> so the
// app's stylesheet wins ties; the SDK's own components still get its styles.
const SDK_STYLE_ID = "__wallet-connect-kit-styles__";

function hoistSdkStyles() {
  const style = document.getElementById(SDK_STYLE_ID);
  if (style && style.parentNode === document.head && document.head.firstChild !== style) {
    document.head.insertBefore(style, document.head.firstChild);
  }
}

if (typeof document !== "undefined") {
  hoistSdkStyles();
  new MutationObserver(hoistSdkStyles).observe(document.head, { childList: true });
}

type AppTheme = "dark" | "light";

function readAppTheme(): AppTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Follows the header theme switch so the DogeOS modal matches the app. */
function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>(readAppTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readAppTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export function isEvmAddress(value?: string | null): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));
}

function signatureToHex(signature: string | Uint8Array) {
  if (typeof signature === "string") return signature;
  return `0x${Array.from(signature, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Mirrors the DogeOS wallet session into the app: the connected EVM address is
 * the user's identity, and the wallet signs the backend's sign-in challenge to
 * obtain the studio JWT. Disconnecting in the DogeOS modal signs the user out.
 */
function DogeOSSessionSync() {
  const { connectionStatus } = useWalletConnect();
  const { address, chainType, currentWallet, signMessage } = useAccount();
  const evmAddress = chainType === "evm" && isEvmAddress(address) ? address.toLowerCase() : null;
  const walletName = currentWallet?.info?.name ?? null;
  const previousAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (evmAddress) {
      setWalletIdentity({ walletAddress: evmAddress, walletName });
      registerWalletSigner(
        signMessage
          ? {
              address: evmAddress,
              signMessage: async (message) => signatureToHex(await signMessage({ message })),
            }
          : null,
      );
      if (previousAddressRef.current !== evmAddress) {
        previousAddressRef.current = evmAddress;
        if (!hasUsableCachedToken()) {
          clearAuthToken();
          void prefetchAuthToken(true).catch(() => null);
        }
      }
      return;
    }

    // Only a real connected → disconnected transition signs out; the SDK starts
    // "disconnected" on every page load while it restores the session.
    if (connectionStatus === "disconnected" && previousAddressRef.current) {
      previousAddressRef.current = null;
      registerWalletSigner(null);
      clearAuthToken();
      clearWalletIdentity();
    }
  }, [connectionStatus, evmAddress, signMessage, walletName]);

  return null;
}

// The SDK throws on an empty client ID, which would blank the whole app. Keep
// the app browsable and make the missing configuration loud instead; sign-in
// stays hidden until VITE_DOGEOS_CLIENT_ID is set.
const MISSING_CLIENT_ID = "missing-dogeos-client-id";
if (!DOGEOS_CLIENT_ID) {
  console.error("[dogeos] VITE_DOGEOS_CLIENT_ID is not set — DogeOS sign-in is disabled.");
}

export function DogeOSProvider({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  const config = useMemo(() => {
    const next = buildDogeOSConfig(theme);
    return next.clientId ? next : { ...next, clientId: MISSING_CLIENT_ID };
  }, [theme]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectProvider config={config}>
          <DogeOSSessionSync />
          {children}
        </WalletConnectProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
