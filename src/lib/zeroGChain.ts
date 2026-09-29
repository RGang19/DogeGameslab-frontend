import { formatEther, parseEther } from "ethers";
import { defineChain } from "viem";

export const ZERO_G_CHAIN_ID = Number(import.meta.env.VITE_ZERO_G_MAINNET_CHAIN_ID || 16661);
export const ZERO_G_RPC_URL = import.meta.env.VITE_ZERO_G_MAINNET_RPC_URL || "https://evmrpc.0g.ai";
export const ZERO_G_TREASURY_WALLET = import.meta.env.VITE_ZERO_G_TREASURY_WALLET || "";
/** Optional page where users can buy/bridge 0G (opened by "Add 0G"). */
export const ZERO_G_FUNDING_URL = import.meta.env.VITE_ZERO_G_FUNDING_URL || "";

export const zeroGMainnet = defineChain({
  id: ZERO_G_CHAIN_ID,
  name: "0G Mainnet",
  nativeCurrency: {
    name: "0G",
    symbol: "0G",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [ZERO_G_RPC_URL] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan", url: "https://chainscan.0g.ai" },
  },
});

export function formatZeroGAddress(address: string) {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export function formatZeroGBalance(wei: bigint, maxDecimals = 4) {
  const whole = wei / 10n ** 18n;
  const fraction = wei % 10n ** 18n;
  if (fraction === 0n) return `${whole} 0G`;
  const fractionText = fraction.toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return `${whole}.${fractionText} 0G`;
}

/** Human-readable 0G token amount from API/UI (e.g. "10"), never wei. */
export function parseHumanZeroGAmount(amount: number | string | undefined | null): string {
  const raw = String(amount ?? "0").trim();
  if (!raw || raw === "0") return "0";
  if (/e/i.test(raw)) {
    throw new Error("Invalid 0G payment amount. Refresh the page and try again.");
  }
  // Guard against accidentally passing wei (smallest unit) as a whole-token price.
  if (/^\d+$/.test(raw) && raw.length > 12) {
    const human = formatEther(BigInt(raw));
    const fromWei = Number(human);
    if (!Number.isFinite(fromWei) || fromWei > 1000) {
      throw new Error(`Unexpected 0G charge (${human}). Refresh the page and try again.`);
    }
    return human;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Invalid 0G payment amount.");
  }
  if (numeric > 1000) {
    throw new Error(`Unexpected 0G charge (${raw}). Refresh the page and try again.`);
  }
  return raw;
}

export function humanZeroGToWei(amount: number | string): bigint {
  return parseEther(parseHumanZeroGAmount(amount));
}

/** Decimal wei string. */
export function humanZeroGToWeiDecimal(amount: number | string): string {
  return humanZeroGToWei(amount).toString();
}

/** Hex wei string — window.ethereum eth_sendTransaction. */
export function humanZeroGToWeiHex(amount: number | string): string {
  const wei = humanZeroGToWei(amount);
  return `0x${wei.toString(16)}`;
}

/** @deprecated Use humanZeroGToWeiHex — kept for existing imports. */
export function decimalToWeiHex(amount: number | string) {
  return humanZeroGToWeiHex(amount);
}
