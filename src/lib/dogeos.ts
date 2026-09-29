import { ChainTypeEnum, type Chain, type WalletConnectKitConfig } from "@dogeos/dogeos-sdk";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

import { zeroGMainnet } from "./zeroGChain";

// DogeOS — the app layer for Dogecoin. Users sign in with a DogeOS wallet
// (embedded email / Google / X wallet, or an external wallet such as MyDoge).
// Chikyū testnet is the live network today; point these env vars at mainnet
// when it launches.
export const DOGEOS_CLIENT_ID = import.meta.env.VITE_DOGEOS_CLIENT_ID ?? "";
export const DOGEOS_CHAIN_ID = Number(import.meta.env.VITE_DOGEOS_CHAIN_ID || 6281971);
export const DOGEOS_CHAIN_NAME = import.meta.env.VITE_DOGEOS_CHAIN_NAME || "DogeOS Chikyū Testnet";
export const DOGEOS_RPC_URL = import.meta.env.VITE_DOGEOS_RPC_URL || "https://rpc.testnet.dogeos.com/";
export const DOGEOS_EXPLORER_URL =
  import.meta.env.VITE_DOGEOS_EXPLORER_URL || "https://dogeos-testnet.l2scan.co";
export const DOGEOS_IS_TESTNET = (import.meta.env.VITE_DOGEOS_TESTNET ?? "true") !== "false";
export const DOGEOS_FAUCET_URL =
  import.meta.env.VITE_DOGEOS_FAUCET_URL || "https://faucet.testnet.dogeos.com";
export const DOGEOS_SITE_URL = "https://www.dogeos.com";

export const APP_NAME = import.meta.env.VITE_APP_NAME || "DogeGameLab";

/** DOGE brand yellow, from the DogeOS SDK theme. */
export const DOGE_YELLOW = "#fcd436";

export const dogeOS = defineChain({
  id: DOGEOS_CHAIN_ID,
  name: DOGEOS_CHAIN_NAME,
  nativeCurrency: { name: "DOGE", symbol: "DOGE", decimals: 18 },
  rpcUrls: { default: { http: [DOGEOS_RPC_URL] } },
  blockExplorers: { default: { name: "DogeOS L2Scan", url: DOGEOS_EXPLORER_URL } },
  testnet: DOGEOS_IS_TESTNET,
});

export const dogeOSChain = dogeOS satisfies Chain;
export const zeroGChain = zeroGMainnet satisfies Chain;

/** Wagmi mirrors the SDK's EVM chains so wagmi hooks follow the DogeOS wallet. */
export const wagmiConfig = createConfig({
  chains: [dogeOS, zeroGMainnet],
  transports: {
    [dogeOS.id]: http(DOGEOS_RPC_URL),
    [zeroGMainnet.id]: http(zeroGMainnet.rpcUrls.default.http[0]),
  },
});

function appUrl(path = "") {
  if (typeof window === "undefined") return path;
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
}

export function buildDogeOSConfig(theme: "dark" | "light"): WalletConnectKitConfig {
  return {
    clientId: DOGEOS_CLIENT_ID,
    defaultConnectChain: ChainTypeEnum.EVM,
    // DogeOS is home; 0G mainnet is where paid generations settle.
    chains: { evm: [dogeOSChain, zeroGChain] },
    metadata: {
      name: APP_NAME,
      description: "Prompt to playable — build and share games on DogeOS.",
      url: appUrl(),
      icons: [appUrl("brand/icon-192x192.png")],
    },
    theme: {
      defaultTheme: theme,
      themes: {
        light: { colors: { primary: { DEFAULT: DOGE_YELLOW } } },
        dark: { colors: { primary: { DEFAULT: DOGE_YELLOW } } },
      },
    },
  };
}

export function formatDogeAmount(wei: bigint, decimals = 18, maxDecimals = 4) {
  const base = 10n ** BigInt(decimals);
  const whole = wei / base;
  const fraction = wei % base;
  if (fraction === 0n) return whole.toString();
  const text = fraction.toString().padStart(decimals, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return text ? `${whole}.${text}` : whole.toString();
}

export async function fetchDogeOSBalance(address: string): Promise<bigint> {
  const response = await fetch(DOGEOS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });
  const payload = (await response.json()) as { result?: string };
  return payload.result ? BigInt(payload.result) : 0n;
}

export function dogeOSAddressUrl(address: string) {
  return `${DOGEOS_EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

export function dogeOSTxUrl(hash: string) {
  return `${DOGEOS_EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}`;
}
